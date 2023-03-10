var mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
var Reserva = require('./reserva');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const saltRounds = 10;
const Token = require('../models/token');
const mailer = require('../mailer/mailer');
const { link } = require('fs');

var Schema = mongoose.Schema;

const validateEmail = function(email){
    const re = /^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/ ;
    return re.test(email);
};

var usuarioSchema = new Schema({
    nombre: {
        type: String,
        trim: true,
        required: [true, 'El nombre es obligatorio']
    },
    email: {
        type: String,
        trim: true,
        required: [true, 'El email es obligatorio'],
        lowercase: true,
        unique: true,
        validate: [validateEmail, 'por favor ingrese un email válido'],
        match:[/^\w+([.-_+]?\w+)*@\w+([.-]?\w+)*(\.\w{2,10})+$/]
    },
    password: {
        type: String,
        required: [true, 'El password es obligatorio']
    },
    passwordRestToken: String,
    passwordRestTokenExpires: Date,
    verificado:{
        type: Boolean,
        default: false
    },
    googleId: String,
    facebookId: String
});

usuarioSchema.plugin(uniqueValidator, { message: 'el {PATH} ya existe con otro usuario'});

usuarioSchema.pre('save', function(next){
    if (this.isModified('password')) {
        this.password = bcrypt.hashSync(this.password, saltRounds);
    }
    next();
});

usuarioSchema.methods.validPassword = function(password){
    return bcrypt.compareSync(password, this.password);
}

usuarioSchema.methods.reservar = function(biciId, desde, hasta, cb){
    var reserva = new Reserva({
        usuario: this._id, 
        bicicleta: biciId, 
        desde:desde, 
        hasta:hasta});
    console.log(reserva);
    reserva.save(cb);
}

usuarioSchema.methods.enviar_email_bienvenida = function(cb) {
    const token = new Token({_userId: this.id, token: crypto.randomBytes(16).toString('hex')});
    const email_destination = this.email;
    token.save(function(err){
        if (err) { return console.log(err.message);}

        const mailOptions = {
            from: 'lindsey19@ethereal.email',
            to: email_destination,
            subject: 'Verificación de cuenta',
            text: 'Hola, \n\n' + 'Por favor, para verificar su cuenta haga click en este link: \n' + 'http://localhost:3000' + '\/token/confirmation\/' + token.token + '\n',
        };

        mailer.sendMail(mailOptions, function(err){
            if (err) { return console.log(err.message); }

            console.log('La verificación ha sido enviada al email: ' + email_destination + '.');
        });
    });
}

usuarioSchema.methods.resetPassword = function(cb){
    const token = new Token({_userId: this.id, token: crypto.randomBytes(16).toString('hex')});
    const email_destination = this.email;
    token.save(function(err){
        if (err) { return cb(err);}
        const mailOptions = {
            from: 'no-reply@redbicicletas.com',
            to: email_destination,
            subject: 'Reestablecer password',
            text: 'Hola, \n\n' + 'Por favor, para reestablecer el password de su cuenta haga click en este link: \n' + 'http://localhost:3000' + '\/resetPassword\/' + token.token + '.\n'
        };
        mailer.sendMail(mailOptions, function(err){
            if (err) { return console.log(err.message); }

            console.log('se envió un email para reestablecer su password a: ' + email_destination + '.');
        });
        cb(null);
    });
}

usuarioSchema.statics.findOneOrCreateByFacebook = function findOneOrCreate(condition, callback){
    const self = this;
    console.log(condition);
    self.findOne({
        $or: [
            {'facebookId': condition.id}, {'email': condition.emails[0].value}
        ]}, (err, result) => {
            if (result) {
                callback(err, result)
            } else{
                console.log('--------- CONDITION ---------');
                console.log(condition);
                let values = {};
                values.facebookId = condition.id;
                values.email = condition.emails[0].value;
                values.nombre = condition.displayName || 'SIN NOMBRE';
                values.verificado = true;
                values.password = crypto.randomBytes(16).toString('hex');
                console.log('--------- VALUES ---------');
                console.log(values);
                self.create(values, (err, result) => {
                    if (err) {console.log(err);}
                    return callback(err, result)
                })
            }
        }
    )
};

usuarioSchema.statics.findOneOrCreateByGoogle = function findOneOrCreate(condition, callback){
    const self = this;
    console.log(condition);
    self.findOne({
        $or:[
            {'googleid': condition.id}, {'email': condition.emails[0].value}
        ]}, (err, result) => {
            if(result){
                callback(err, result)
            }else {
                console.log('--------CONDITION--------');
                console.log(condition);
                let values = {};
                values.googleid = condition.id;
                values.email = condition.emails[0].value;
                values.nombre = condition.displayName || 'SIN NOMBRE';
                values.verificado = true;
                values.password = condition._json.etag;
                console.log('--------VALUES--------');
                console.log(values);
                self.create(values, (err, result) => {
                    if (err) {console.log(err);}
                    return callback(err, result)
                })
            }
    })
};



module.exports = mongoose.model('Usuario', usuarioSchema);