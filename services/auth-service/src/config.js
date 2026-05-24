require('dotenv').config();

const config = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10),
};

module.exports = config;
