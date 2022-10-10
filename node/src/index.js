const express = require('express')
const cookieparser = require('cookie-parser')
const session = require('express-session')
const axios = require("axios");
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { MongoClient } = require('mongodb')
const cors = require('cors')
const e = require("express");

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

// CORS
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, content-type, Accept, Authorization, Access-Control-Allow-Credentials');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

// Session middleware
app.use(session({
    secret: 'keyboard cat',
    saveUninitialized: true,
    cookie: { maxAge: oneMinute },
    resave: false,
}))

// Parse incoming requests data
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// static file
app.use(express.static(__dirname))

// Parse cookies
app.use(cookieparser())

/*app.use((req, res, next) => {
    if(!exclude(req.url)) {
        const header = req.headers['authorization'] || ''
        const token = header.split(' ')[1]

        try {
            if (!req.url.includes('refresh')) {
                if (req.session.username && token) {
                    return jwt.verify(token, 'not_a_secret', (err, user) => {
                        if (err) {
                            res.status(403).send({success: false})
                            throw err
                        }
                        return next()
                    })
                }
                res.status(401).send('Unauthorized')
                return
            }
            return next()
        }catch (e){
            res.status(401).send('Unauthorized')
            return
        }
    }
    return next()
})*/

// username and password
const user = 'admin'
const pass = 'admin'

let sessionData = {}

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
        console.log(username, passwordCrypt);
        const user = await collection.findOne({ username: username, password: passwordCrypt })
        console.log(user);
        if (user) {
            sessionData = req.session
            sessionData.username = username
            sessionData.password = password
            const token = jwt.sign({ user }, 'not_a_secret', { expiresIn: '60s' })
            res.status(200).send({ success: true, token })
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
    if(!apis[api] || !endpoint) {
        return res.status(400).send({ success: false , error: 'Invalid endpoint or not valid api'})
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
    if(!token) {
        return res.status(401).send({ success: false })
    }
    jwt.verify(token, 'not_a_secret', (err, user) => {
        if(err) {
            return res.status(403).send({ success: false })
        }
        res.status(200).send({ success: true, user })
    })
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
    console.log(req.session)
    const {username} = req.session
    if(username){
        const token = jwt.sign({ username }, 'not_a_secret', { expiresIn: '60s' })
        res.status(200).send({ success: true, token })
    }else {
        res.status(401).send({ success: false })
    }
})

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
