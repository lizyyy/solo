const { Sequelize } = require('sequelize')
const path = require('path')

const databasePath = process.env.DB_PATH || path.join(__dirname, '../../data/database.sqlite')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: databasePath,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  }
})

module.exports = sequelize