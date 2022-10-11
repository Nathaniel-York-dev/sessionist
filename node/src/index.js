const express = require('express')
const cookieparser = require('cookie-parser')
const session = require('express-session')
const axios = require("axios");
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const mongoStore = require('connect-mongodb-session')(session)
const { MongoClient } = require('mongodb')
const uriMongo = 'mongodb://mongo:27017'
const cors = require('cors')
const store = new mongoStore({
    databaseName: 'sessionist',
    collection: 'userSessions',
    uri: uriMongo,
    expires: 1000 * 60 * 60
})

const app = express()
const PORT = 3008

const oneMinute = 1000 * 60 * 60

const apis = {
    pokemon: 'https://pokeapi.co/api/v2/',
    rickandmorty: 'https://rickandmortyapi.com/api/',
    breakingbad: 'https://www.breakingbadapi.com/api/',
    starwars: 'https://swapi.dev/api/',
    marvel: 'https://gateway.marvel.com:443/v1/public/',
    anilist: 'https://graphql.anilist.co',
    drink: 'https://www.thecocktaildb.com/api/',
    food: 'https://www.themealdb.com/api/json/v1/1/',
    covid: 'https://covid19.mathdro.id/api',
}

// Session middleware
app.use(session({
    name: 'session',
    secret: 'not_a_secret',
    store: store,
    saveUninitialized: false,
    resave: false,
    cookie: {
        domain: '.mirror.local',
        sameSite: false,
        secure: false,
        maxAge: oneMinute,
        httpOnly: true
    }
}))
const allowedOrigins = ['http://localhost:4200', 'http://info.cern.ch', 'http://localhost:3200', 'http://dev.mirror.local:4200']
// Cors middleware
app.use(cors({
    origin: (origin, callback) => {
        if(allowedOrigins.includes(origin)) {
            callback(null, true)
        }else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true
}))

// CORS
/*app.use(function (req, res, next) {

    const allowedOrigins = ['http://localhost:4200', 'http://info.cern.ch', 'http://localhost:3200']
    const origin = req.headers.origin
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    // Website you wish to allow to connect
    //res.setHeader('Access-Control-Allow-Origin', 'http://info.cern.ch/');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, content-type, Accept, Authorization, Access-Control-Allow-Credentials');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});*/

// Parse incoming requests data
app.use(express.json())
//app.use(express.urlencoded({ extended: true }))

// static file
//app.use(express.static(__dirname))

// Endpoint to login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body
    const url = 'mongodb://mongo:27017'
    const client = new MongoClient(url)
    if (!username || !password) {
        return res.status(400).send('Username and password are required')
    }
    client.connect().then( async () => {
        const db = client.db('sessionist')
        const collection = db.collection('users')
        const passwordCrypt = crypto.createHash('sha256').update(password).digest('hex')
        const user = await collection.findOne({ username: username, password: passwordCrypt })
        if (user) {
            const token = jwt.sign({ user }, 'not_a_secret', { expiresIn: '60s' })
            req.session.user = {
                username: user.username,
                email: user.email,
                token: token
            }
            req.session.save( err =>{
                console.log(err, req.session)
                if(!err) {
                    res.send(req.session.user)
                }
            })
        }else {
            res.status(401).send({ success: false })
        }
    }).catch(err => {
        res.status(500).send({ success: false })
    })
})



// Endpoint to logout
app.get('/api/logout', (req, res) => {
    req.session.destroy()
    res.status(200).send({ success: true })
})

// Endpoint to mirror other api
app.post('/mirror/:api', (req, res) => {
    const { api } = req.params
    const { endpoint } = req.body
    const token = req.headers['authorization'] || ''
    const validatedToken = validateToken(token.split(' ')[1])
    if(!apis[api] || !endpoint) {
        return res.status(400).send({ success: false , error: 'Invalid endpoint or not valid api'})
    }
    if(!validatedToken){
        return res.status(401).send({ success: false , error: 'Invalid token'})
    }
    axios.get(`${apis[api]}${endpoint}`, req.body).then((response) => {
        res.status(200).send(response.data)
    }).catch((error) => {
        res.status(500).send({ success: false , error: error})
    })
})

// Endpoint to check if user is logged in
app.get('/api/check', (req, res) => {
    const header = req.headers['authorization'] || ''
    const token = header.split(' ')[1]
    const validatedToken = validateToken(token);
    //console.log(req.session)
    //const {username} = req.session
    if (validatedToken) {
        res.status(200).send({ success: true, session: validatedToken})
    }else {
        res.status(401).send({ success: false })
    }
})

// Endpoint to register a new user
app.post('/api/register', (req, res) => {
    const { username, email ,password } = req.body
    if(!username || !password || !email || !validateEmail(email)) {
        return res.status(400).send({ success: false, error: 'Invalid username or password' })
    }
    const hash = crypto.createHash('sha256').update(password).digest('hex')
    const user = { username, email, password: hash }
    const url = 'mongodb://mongo:27017'
    const client = new MongoClient(url)
    client.connect().then(() => {
        const db = client.db('sessionist')
        const collection = db.collection('users')
        collection.insertOne(user).then(() => {
            res.status(200).send({ success: true })
        }).catch((error) => {
            res.status(500).send({ success: false, error })
        })
    }).catch((error) => {
        res.status(500).send({ success: false, error })
    })
})

// Enpoint to refresh token
app.post('/api/refresh', (req, res) => {
    //const {username, email} = req.session
    if(true){
        const token = jwt.sign({ user }, 'not_a_secret', { expiresIn: '60s' })
        res.status(200).send({ success: true, token })
    }else {
        res.status(401).send({ success: false })
    }
})

//Validate jwt token
async function validateToken(token) {
    try {
        return await jwt.verify(token, 'not_a_secret')
    } catch (err) {
        return false
    }
}

// Regex to check if email is valid
function validateEmail(email) {
    const re = /\S+@\S+\.\S+/
    return re.test(email)
}

// Regext to exclude some endpoints
function exclude(url) {
    const regex = /\/(login|register)/
    return regex.test(url)
}

// Init listener port
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
