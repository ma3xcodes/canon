module.exports = function(sequelize, db) {

  const userModel = {
    id: {
      allowNull: false,
      primaryKey: true,
      type: db.STRING
    },
    username: {
      type: db.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: db.STRING
    },
    name: {type: db.STRING},
    password: {type: db.STRING},
    salt: {type: db.STRING},
    twitter: {type: db.STRING},
    facebook: {type: db.STRING},
    instagram: {type: db.STRING},
    activated: {type: db.BOOLEAN, allowNull: false, defaultValue: false},
    activateToken: {type: db.STRING},
    activateTokenExpiry: {type: db.DATE},
    resetToken: {type: db.STRING},
    resetTokenExpiry: {type: db.DATE},
    createdAt: {
      allowNull: false,
      type: db.DATE
    },
    updatedAt: {
      allowNull: false,
      type: db.DATE
    },
    role: {
      allowNull: false,
      defaultValue: 0,
      type: db.INTEGER
    }
  };

  sequelize.getQueryInterface().createTable("users", userModel);

  return sequelize.define("users", userModel);

};
