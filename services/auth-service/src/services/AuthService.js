const AppError = require('../../../../shared/utils/AppError');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const config = require('../config');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const ms = require('ms');
const { RABBIT_EXCHANGES, RABBIT_ROUTING_KEYS } = require('../../../../shared/constants/constant');

const storeRefreshToken = async (jti, userId, ttlSeconds) => {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await RefreshToken.create({ jti, userId, expiresAt });
};
class AuthService {
    constructor(logger, mqManager) {
        this.logger = logger;
        this.mqManager = mqManager;
    }

    createUser = async (data) => {
        const exists = await User.findByEmail(data.email);
        if (exists) throw AppError.conflict(`User with email ${data.email} already exists`);
        const user = await User.create({ ...data });

        //Publish event to message broker (RabbitMQ) for employee creation
        await this.mqManager.publish(
            RABBIT_EXCHANGES.USER_EVENTS,
            RABBIT_ROUTING_KEYS.USER_CREATED,
            {
                userId: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                joiningDate: user.createdAt.toISOString(),
                isActive: user.isActive,
            }
        );
        this.logger.info('[AuthService] User created', { userId: user._id, role: user.role });
        return user;
    };

    login = async (data) => {
        const { email, password } = data;
        const user = await User.findByEmail(email, true);
        if (!user) throw AppError.unauthorized('Invalid email or password');
        if (!user.isActive) throw AppError.forbidden('Account deactivated. Contact your administrator.');

        const isValidUser = await user.comparePassword(password);
        if (!isValidUser) throw AppError.unauthorized('Invalid email or password');

        user.lastLogin = new Date();
        await user.save();

        const { accessToken, refreshToken } = await this._issueTokenPair(user);
        this.logger.info('[AuthService] Login successful', { userId: user._id, role: user.role });

        const { password: _omit, ...safeUser } = user.toObject();
        return {
            accessToken,
            refreshToken,
            accessTokenExpiresIn: config.jwt.expiresIn,
            refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
            tokenType: 'Bearer',
            user: safeUser,
        };
    }

    verifyToken = async (token) => {
        try {
            const decoded = jwt.verify(token, config.jwt.secret, { issuer: 'leave-management' });
            return decoded;
        } catch (error) {
            throw AppError.unauthorized('Invalid or expired token');
        }
    }

    refresh = async (incomingRefreshToken) => {
        // 1. Verify the JWT signature and expiry
        let decoded;
        try {
            decoded = jwt.verify(incomingRefreshToken, config.jwt.refreshSecret, { issuer: 'leave-management' });
        } catch (error) {
            throw AppError.unauthorized('Invalid or expired refresh token');
        }

        if (decoded.type !== 'refresh') {
            throw AppError.unauthorized('Invalid token type');
        }

        // 2. Check the jti exists in DB — if not, it was already used or revoked
        const stored = await RefreshToken.findOne({ jti: decoded.jti });
        if (!stored) {
            throw AppError.unauthorized('Refresh token has been revoked or already used');
        }

        // 3. Load the user
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
            throw AppError.unauthorized('User not found or deactivated');
        }

        // 4. Rotate — delete old token row, issue new pair
        await RefreshToken.deleteOne({ jti: decoded.jti });
        const { accessToken, refreshToken: newRefreshToken } = await this._issueTokenPair(user);

        this.logger.info('[AuthService] Token refreshed', { userId: user._id });
        return {
            accessToken,
            refreshToken: newRefreshToken,
            accessTokenExpiresIn: config.jwt.expiresIn,
            refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
            tokenType: 'Bearer',
        };
    }

    logout = async (incomingRefreshToken) => {
        let decoded;
        try {
            decoded = jwt.verify(incomingRefreshToken, config.jwt.refreshSecret, { issuer: 'leave-management' });
        } catch {
            // Expired or invalid JWT — session is effectively dead already, treat as logged out
            return;
        }

        // Check the DB — if the jti is not found, this token was already rotated or revoked.
        // The old token's jti was deleted during /refresh rotation, so it can't be used to
        // invalidate the new session. Return success (idempotent) but log the difference.
        const result = await RefreshToken.deleteOne({ jti: decoded.jti });

        if (result.deletedCount === 0) {
            this.logger.warn('[AuthService] Logout attempted with already-revoked token', { userId: decoded.userId, jti: decoded.jti });
            throw AppError.unauthorized('Token is invalid or has already been revoked');
        }

        this.logger.info('[AuthService] Logout successful', { userId: decoded.userId });
    }

    logoutAll = async (userId) => {
        const result = await RefreshToken.deleteMany({ userId });
        this.logger.info('[AuthService] Logout all sessions', { userId, sessionsRevoked: result.deletedCount });
    }

    //Helper Methods//

    async _issueTokenPair(user) {
        const accessTokenJti = uuidv4();
        const refreshTokenId = uuidv4();

        const basePayload = {
            userId: user._id.toString(),
            role: user.role,
            email: user.email,
            name: user.name,
        };

        const accessToken = jwt.sign(
            { ...basePayload, jti: accessTokenJti },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn, issuer: 'leave-management' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id.toString(), type: 'refresh', jti: refreshTokenId },
            config.jwt.refreshSecret,
            { expiresIn: config.jwt.refreshExpiresIn, issuer: 'leave-management' }
        );

        // Persist refresh token in mongodb with TTL
        const refreshTtlSeconds = Math.floor(ms(config.jwt.refreshExpiresIn) / 1000);
        await storeRefreshToken(refreshTokenId, user._id.toString(), refreshTtlSeconds
        );

        return { accessToken, refreshToken, refreshTokenId, accessTokenJti };
    }
}

module.exports = AuthService;