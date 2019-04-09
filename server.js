const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const cors = require('cors');
const mongodb = require('mongodb');
const mongoose = require('mongoose');

// connect to mongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true }, function(error) {
  console.log(error);
});

// set up schema and model for database
const userSchema = new mongoose.Schema({
  username: {type: String, required: true},
  exercise: [{
    description: String,
    duration: String,
    date: String
  }]
});
const User = mongoose.model('User', userSchema);

app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// create a new user
app.post('/api/exercise/new-user', function(req, res) {
  const newUser = new User({username: req.body.username});
  newUser.save(function(err, user) {
    console.log(err);
    console.log(user);
    res.json({username: user.username, _id: user._id});
  });
});

// get an array of all users including their usernames and id
app.get('/api/exercise/users', function(req, res) {
  User.find({}).then(function(users) {
    res.json(users);
  });
});

// add exercise to an existing user
app.post('/api/exercise/add', function(req, res) {
  const date = req.body.date ? req.body.date : new Date().toISOString().slice(0,10);
  const newExercise = {description: req.body.description, duration: req.body.duration, date: date};
  User.findByIdAndUpdate(req.body.userId, {$push: {exercise: newExercise}}, {new: true}).then(function(user) {
    res.json(user);
  });
});

// retrieve user exercise log by querying using userId, and optionally from/to dates and limit number of returns
// i.e.  /api/exercise/log?{userId}[&from][&to][&limit]
app.get('/api/exercise/log', function(req, res) {
  const userId = req.query.userId;
  const from = req.query.from;
  const to = req.query.to;
  const limit = req.query.limit;
  var log = [];
  
  User.findById(userId, function(err, user) {
    user.exercise.sort((a, b) => {
      return Date.parse(a.date) - Date.parse(b.date);
    }).map(exercise => 
         log.push({date: exercise.date, description: exercise.description, duration: exercise.duration})
    );

    if (from) { log = log.filter( exercise => { return Date.parse(exercise.date) >= Date.parse(from) })};
    if (to) { log = log.filter( exercise => { return Date.parse(exercise.date) <= Date.parse(to) })};
    if (limit<log.length) { log = log.slice(0, limit) };
    
    log.push({'total exercise count': log.length});    
    
    res.json(log);
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
