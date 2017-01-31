// server.js will be our website's server that handles communication
// between the front-end and the database


/* SETUP ---------------------------------------------------------------*/

// - Express is a Node framework that makes everything easier
// - require returns a 'module', which is essentially an object
// packed with functions
var express = require('express');
var app = express();

// - Mongodb is the database that we will be using
// - mongojs is a module that has some useful functions
var mongojs = require('mongojs');
var db = mongojs('users', ['users']); // we want the 'users' database
var db_classes = mongojs("classes", ["classes"]); 
var db_rooms = mongojs("rooms", ["rooms"]); //yung flat data

// - body-parser is middle-ware that parses http objects,
// or something to that effect (don't worry about it)
var bodyParser = require('body-parser');

// - email stuff
var nodemailer = require("nodemailer");
var mailTransporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {user: "studyspacehelper@gmail.com", pass: "raindropdroptop"} 
});

// - Peer server stuff
var ExpressPeerServer = require('peer').ExpressPeerServer;
var server = require('http').createServer(app);
app.use('/peerjs', ExpressPeerServer(server, {debug: true}));
server.listen(9000);

// - Firebase admin setup
var firebaseAdmin = require("firebase-admin");
var serviceAccount = require("./dontlookhere/porn/topsecret.json"); //shhhh
var firebase = firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://studyspace-490cd.firebaseio.com/"
});
var firebaseRoot = firebase.database().ref();
var classRoomsDatabase = firebaseRoot.child("ClassRooms");
var roomInfoDatabase = firebaseRoot.child("RoomInfo");
var roomMessagesDatabase = firebaseRoot.child("RoomMessages");

// - app configuration
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
/*-----------------------------------------------------------------------*/

var MAIN_HOST = "mainhost";
var ADMIN_KEY = "ABCD"
//var classes_dict = {};
//classes_dict["ucsd_cse_110_1"] = new Class("ucsd_cse_110_1", "CSE 110 Gillespie", []);
//classes_dict["ucsd_cse_105_1"] = new Class("ucsd_cse_105_1", "CSE 105 Tiefenbruck", []);
//var rooms_dict = {};

/* HTTP requests ---------------------------------------------------------*/


/* User settings ---------------*/
// forces the name property to be unique in user_classes collection
//db.user_classes.createIndex({name: 1}, {unique:true});

app.post('/user_classes', function(req, res) {

	db.user_classes.insert(req.body, function(err, docs){
		db.user_classes.ensureIndex({name: req.body}, {unique:true});
		res.json(docs);
	});	

});

app.delete('/user_classes/:id', function(req, res){

	var id = req.params.id;
	db.user_classes.remove({_id: mongojs.ObjectId(id)}, function(err, doc){
		res.json(doc);
	});
});

//NOTE:Need to get userID working so it only gets the classes of this user
app.get('/user_classes/:id', function(req, res) {

	db.user_classes.find({user_id: req.params.id}, function(err, docs){
		res.json(docs);
	});
});

/*---------------------------*/


/* Class/room functionality ----------------*/

app.get('/add_tutor/:class_id/:tutor_id/:admin_key', function (req, res) {
	var class_id = req.params.class_id;
	var tutor_id = req.params.tutor_id;
	var admin_key = req.params.admin_key;

	// if the admin_key is correct
	if (admin_key == ADMIN_KEY) {

		// if the tutor is not already a tutor for this class
		if (classes_dict[class_id].tutor_ids.indexOf(tutor_id) == -1) {
			classes_dict[class_id].tutor_ids.push(tutor_id);
		}

		// back up tutor in database
	}
});

app.get('/add_room/:class_id/:room_name/:host_id/:is_lecture', function(req, res) {
	var room_id = addRoom(req.params.class_id, req.params.room_name, 
		req.params.host_id, req.params.is_lecture, function(room_id){res.send(room_id);});
});

// - adds user_id to room with id room_id
// - returns list of user_id's in that room
app.get('/join_room/:room_id/:user_id', function(req, res) {

	var room_id = req.params.room_id;
	var user_id = req.params.user_id;
  joinRoom(user_id, room_id, function(roomInfo){res.send(roomInfo);});
});

// - removes user_id from room with id room_id
app.get('/leave_room/:room_id/:user_id', function(req, res) {
	
	var room_id = req.params.room_id;
	var user_id = req.params.user_id;

  leaveRoom(user_id, room_id, function(success){res.send(success);});
});

/*------------------------------------------------*/






/* Account system (login, signup, verification) -----*/

// - returns user with given email / password
app.post('/accountlogin', function(req, res) {

  var email = req.body.email;
  var password = req.body.password;
  console.log("get user with email " + email + " and pass " + password);
  db.users.findOne({email: email, password: password}, function (err, doc) {
    res.json(doc);
  });
});

/* POST data: New account info with {email, password}
 * Returns: {success} - whether or not it succeeded */
app.post("/accountsignup", function(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  console.log("Account signup: attempt with - " + email);
  db.users.findOne({email:email}, function (err, doc) {
    //if user doesn't exist yet (doc is null), insert it in
    if (!doc) {
      var newUser = new User(email, password);
      db.users.insert(newUser, function(err, doc) {
        if (doc) {
          console.log("Account signup: ACCOUNT CREATED");
          //sendVerifyEmail(newUser);
          res.json({success: true});
        }
        else {
          console.log("Account signup: SOMETHING WEIRD HAPPENED");
          res.json({success: true});
        }
      });
    }
    else {
      console.log("Account signup: error - account already exists");
      res.json({success: false});
    }
  });
});

/* GET data: {ID of account to verify, token} - verify account with token
 * Returns: {success} - whether or not the account was verified */
app.get("/accountverify/:id/:token", function(req, res) {
  var id = req.params.id;
  var token = req.params.token;
  if (id.length == 24) {
    db.users.findOne({_id: mongojs.ObjectId(id)}, function (err, doc) {
      //check if user exists
      if (doc) {
        //verify the user if the token matches
        if (token == doc.token) {
          db.users.findAndModify({query: {_id: mongojs.ObjectId(id)}, 
            update: {$set: {active: true}}, new: true}, function(err, doc) {
              if (doc) {
                console.log("Account verification: ACCOUNT VERIFIED");
                res.json({success:true});
              }
              else {
                console.log("WEIRD ASS ERROR - ACCOUNT EXISTS, BUT CAN'T MODIFY");
                sendVerifyError(res);
              }
          });
        }
        //either some guy tryna hack or some typo happened
        else {
          console.log("Account verification: error - wrong token");
          sendVerifyError(res);
        }
      }
      //either some guy tryna hack or some typo happened
      else {
        console.log("Account verification: error - non-existent account");
        sendVerifyError(res);
      }
    });
  }
  else {
    console.log("Account verification: error - impossible ID");
    sendVerifyError(res);
  }
});

/*------------------------------------------------------------------------*/


/* Model -----------------------------------------------------------------*/

function User(email, password) {
//this._id = whatever mongo gives us
  this.email = email;
  this.password = password;
  this.token = "dank"; //generateToken();
  this.active = true; //has verified email
}

function Class(class_id, class_name, class_room_ids) {
	this.class_id = class_id;	// "ucsd_cse_110_1"
	this.name = class_name; // "CSE 110 Gillespie"
	this.room_ids = class_room_ids; // list of room ids for this class
	this.tutor_ids = {};
}

function Room(room_id, room_name, room_host_id, room_users, class_id, is_lecture) {
	this.room_id = room_id;
	this.name = room_name;
	this.host_id = room_host_id;
	this.users = room_users;
	this.class_id = class_id;
	this.is_lecture = is_lecture;
	this.has_tutor = false;
}

function addRoom(class_id, room_name, room_host_id, is_lecture, callback) {

  var room_id = class_id + "_" + generateToken();
  console.log("FIREBASE: Attempting to add room with id " + room_id);

  var newRoom = new Room(room_id, room_name, room_host_id, [], class_id, is_lecture);
  var classRoomRef = classRoomsDatabase.child(class_id).push(); //push new room id into class list of rooms
  classRoomRef.set(room_id);
  console.log("FIREBASE: Successfully added roomid " + room_id + " to class " + class_id);

  //push new room info into room info database under room id
  roomInfoDatabase.child(room_id).set(newRoom, function(err) {
    if (!err) {
      console.log("FIREBASE: Room " + room_id  + " successfully inserted into RoomInfo database");
      roomInfoDatabase.child(room_id).update({firebase_push_id: classRoomRef.key}) 
      if (callback) {
        callback({room_id: room_id});
      }
    }
    else {
      console.log("FIREBASE: Error - failed to add room " + room_id + " to RoomInfo database");
    }
  });

}

function removeRoom(room_id) {

	console.log("FIREBASE: Attempting to remove room with id " + room_id);
  
  roomInfoDatabase.child(room_id).once("value").then(function(snapshot) {
    if (snapshot.val()) {
      var push_id = snapshot.val().firebase_push_id;
      var class_id = snapshot.val().class_id;
      classRoomsDatabase.child(class_id).child(push_id).remove(function(err) {
        roomInfoDatabase.child(room_id).remove(function(err) {
          console.log("FIREBASE: Room " + room_id  + " succesfully deleted from RoomInfo and ClassRooms");
        });
      });
          }
    else {
      console.log("FIREBASE: Failed - Didn't delete room " + room_id);
    }
  });
}

function joinRoom(user_id, room_id, callback) {
	console.log("FIREBASE: Attempting to add user " + user_id + " to room " + room_id);

  roomInfoDatabase.child(room_id).once("value").then(function(snapshot) {
    if (snapshot.val()) {
      roomInfoDatabase.child(room_id).child("users").push().set(user_id, function(err) {
        if (!err) {
          console.log("FIREBASE: Successfully added user " + user_id + " to room" + room_id);
        }
        else {
          console.log("FIREBASE: Failed - Didn't add user");
          console.log("Error message if it helps: " + err);
        }
        
        //send back room in callback
        if (callback) {
          roomInfoDatabase.child(room_id).once("value").then(function(snapshot) {
            callback(snapshot.val());
          });
        }
      });
    }
    else {
      console.log("FIREBASE: Failed - Room doesn't exist anymore, user failed to join");
      if (callback) {
        callback(null);
      }
    }
  });

}

function leaveRoom(user_id, room_id, callback) {
	console.log("FIREBASE: Attempting to remove user " + user_id + " from room " + room_id);

  roomInfoDatabase.child(room_id).child("users").once("value").then(function(snapshot) {
    if (snapshot.val()) {
      snapshot.forEach(function(childSnapshot) {
        var key = childSnapshot.key;
        var value = childSnapshot.val();
        if (value == user_id) {
          childSnapshot.ref.remove(function(err) {
            checkToDelete(room_id);
          });
        }
      });

    }
    else {
      console.log("FIREBASE: Error - room no longer exists");
      if (callback) {
        callback({success:false});
      }
    }

  });
}

function checkToDelete(room_id) {
  console.log("FIREBASE: Checking delete conditions");
  roomInfoDatabase.child(room_id).child("users").once("value").then(function(snapshot) {
    if (!snapshot.val()) {
      console.log("FIREBASE: Attempting to delete room");
      snapshot.ref.parent.once("value").then(function(snapshot) {
        if (snapshot.val()) {
          var class_id = snapshot.val().class_id;
          var firebase_push_id = snapshot.val().firebase_push_id;
          classRoomsDatabase.child(class_id).child(firebase_push_id).remove();
          snapshot.ref.remove();
          console.log("FIREBASE: Succesfully deleted room " + room_id);
        }
        else {
          console.log("FIREBASE: Couldn't find room to delete");
        }
      });
    }
  });
}

function tutorInRoom(room) {
	for (user_id in room.users) {
		for (tutor_id in classes_dict[room.class_id].tutor_ids) {
			if (user_id = tutor_id) {
				return true;
			}
		}
	}
	return false;
}

function generateMainRooms() {
  /*
	console.log("generating main rooms");
	for (var class_id in classes_dict) {
		addRoom(class_id, "main", MAIN_HOST, false);
	}
  */
}

function logClassesAndRooms() {
  /*
	console.log("******************** CLASSES ********************")
	console.log(classes_dict);
	console.log("*************************************************")	
	logRooms();	
  */
}

function logRooms() {
  /*
	console.log("******************** ROOMS **********************")
	console.log(rooms_dict);
	console.log("*************************************************")	
  */
}


/* Class/room database methods--------*/

function addRoomIDToClass(class_id, room_id) {

}

function addRoomToDatabase(room) {

}




/*------------------------------------------------------------------------*/


/* Helper methods --------------------------------------------------------*/

//send any error messages back to client
function sendVerifyError(res) {
  res.json({success:false}); //add anything needed to json
}

//generate a token of 10 random chars
function generateToken() {
  var token = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for( var i=0; i < 10; i++ ) {
    token += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return token;
}

//sends a verification email to user
function sendVerifyEmail(user, callback) {
  var receiver = user.email;
  var id = user._id;
  var token = user.token;
  var emailText = "http://localhost:3000/accountverify/" + id + "/" + token;
  var verifyEmailOptions = {
    from: "studyspacehelper@gmail.com",
    to: receiver, 
    subject: "Account verification",
    text: emailText,
    html: "<a href='" + emailText + "'>" + emailText + "</a>"
  };
  mailTransporter.sendMail(verifyEmailOptions, callback);
}

/*------------------------------------------------------------------------*/


app.listen(3000);
console.log("Server running on port 3000");
generateMainRooms();

//addRoom("TEST", "TEST_ROOM", MAIN_HOST, false);
//removeRoom("TEST_fLOXccNn2q");
//joinRoom("ID2", "TEST_rcf0hH5Xk7");
//leaveRoom("ID1", "TEST_rcf0hH5Xk7");
//checkToDelete("cse110_mP0GFqH181");
