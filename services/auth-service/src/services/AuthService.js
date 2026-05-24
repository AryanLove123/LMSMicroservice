const AppError = require('../../../../shared/AppError');
const User = require('../models')
class AuthService {
    createUser = async (data) => {
        const exists = await User.findByEmail(email);
        if (exists) throw AppError.conflict(`User with email ${data.email} already exists`);
        const user = await User.create({ ...data, employeeId: data.employeeId || uuidv4() });
        this.logger.info('[AuthService] User created', { userId: user._id, role: user.role });
        return user;
    };

    login = async (data) =>{
        const {email, password} = data;
        const user = await User.findByEmail(email);
        if (!user) throw AppError.unauthorized('Invalid email or password');
        if (!user.isActive) throw AppError.forbidden('Account deactivated. Contact your administrator.');
        
        const isValidUser = await user.comparePassword(password);
        if (!isValidUser) throw AppError.unauthorized('Invalid email or password');

        user.lastLogin = new Date();
        await user.save();

        const { accessToken, refreshToken } = await this._issueTokenPair(user);
        this.logger.info('[AuthService] Login successful', { userId: user._id, role: user.role });
        return {
            accessToken,
            refreshToken,
            accessTokenExpiresIn: config.jwt.expiresIn,
            refreshTokenExpiresIn: config.jwt.refreshExpiresIn,
            tokenType: 'Bearer',
            user,
        };
    }

    verifyToken = async (token) =>{
        try {
            const decoded = jwt.verify(token, config.jwt.secret, { issuer: 'leave-management' });
            return decoded;
        } catch (error) {
            throw AppError.unauthorized('Invalid or expiredtoken');
        }
    }


    //Helper Methods//

    async _issueTokenPair(user) {
    const accessTokenJti = uuidv4();
    const refreshTokenId = uuidv4();

    const basePayload = {
      userId: user._id.toString(),
      employeeId: user.employeeId,
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
    await storeRefreshToken(refreshTokenId,user._id.toString(),refreshTtlSeconds
    );

    return { accessToken, refreshToken, refreshTokenId, accessTokenJti };
  }
}