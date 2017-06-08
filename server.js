var builder = require('botbuilder');
var oauthSignature = require('oauth-signature');
var https = require('https');
var http = require('http');
var path = require('path');

const express = require('express');
const app = express();

var CALLBACK_URL = 'http://localhost:3978/callback';
var CONSUMER_KEY = '92970c7b8213498eb7ffe4f1c9f91d60252f506cff5dc8d8c2c562751b38';
var CONSUMER_SECRET = 'ed695455e9f1c48eb9961518695d75b1441ee4d3bd5484960f16dc57b74';

function NonceGenerator(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function encodeQueryData(data) {
    let ret = [];
    for (let d in data)
        ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
    return ret.join('&');
}

function nextURL(step, baseurl, authtoken, authsecret, callback, userid, lastupdate) {

    var httpMethod = 'GET';
    var url = baseurl;
    var nonce = NonceGenerator(32);
    var timestamp = Math.floor(Date.now() / 1000);

    var parameters = new Object();
    parameters["oauth_consumer_key"] = CONSUMER_KEY;
    parameters["oauth_nonce"] = nonce;
    parameters["oauth_timestamp"] = timestamp;
    parameters["oauth_signature_method"] = 'HMAC-SHA1';
    parameters["oauth_version"] = '1.0';

    if (step == 1) {

        parameters["oauth_callback"] = callback;

        var Signature = oauthSignature.generate(httpMethod, url, parameters, CONSUMER_SECRET, authsecret, { encodeSignature: false });

        parameters["oauth_signature"] = Signature;

        var get_URL = url + '?' + encodeQueryData(parameters);

        return get_URL;

    } else if (step == 2 || step == 3) {
        parameters["oauth_token"] = authtoken;

        var Signature = oauthSignature.generate(httpMethod, url, parameters, CONSUMER_SECRET, authsecret, { encodeSignature: false });

        parameters["oauth_signature"] = Signature;

        var get_URL = url + '?' + encodeQueryData(parameters);

        return get_URL;

    } else if (step == 4) {

        parameters["action"] = 'getmeas';
        parameters["oauth_token"] = authtoken;
        parameters["userid"] = userid;
        parameters["lastupdate"] = lastupdate;

        var Signature = oauthSignature.generate(httpMethod, url, parameters, CONSUMER_SECRET, authsecret, { encodeSignature: false });

        parameters["oauth_signature"] = Signature;

        var get_URL = url + '?' + encodeQueryData(parameters);

        return get_URL;
    }
}

var tokens = new Array();
var users = new Array();
var userdata = new Array();

/*
var temp = new Object;
temp["userid"] = 13618522;
temp["measures"] = new Array();
userdata.push(temp);

users.push({
    userid: 13618522,
    accesscred: {
        accesstoken: 'b0945e18563f3741de1b428dd296bf44948022b63609409d7709ef9cb90',
        accesssecret: '3fe0467553e19df33e5fbed0cf14b38f825d5e0cd305b4f0303655b54cd1'
    },
    lastupdate: 0
}); // Temporarily used. To be deleted
*/

app.use('/static', express.static('views'));

app.listen(3978, function () {
    console.log('Server started and is listening on port 3978');
});

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/callback', function (req, res) {

    var userid = req.query.userid;
    var authtoken = req.query.oauth_token;
    Step3(authtoken, userid);
    res.send("Hey You :)");

    // Close the window here !!
});

app.get('/graph', function (req, res) {

    console.log(req.query);

    var userid = req.query.userid;
    var user = new Object();
    var flag = 0;
    for (var i = 0; i < userdata.length; i++) {
        if (userdata[i].userid == userid) {
            user = userdata[i];
            flag = 1;
            break;
        }
    }

    if (flag == 1) {
        res.send({validuser: true, measures: user.measures});
    } else {
        res.send({validuser: false});
    }
})

function Step3(authtoken, userid) {

    var authsecret = null;
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].authtoken == authtoken) {
            authsecret = tokens[i].authsecret;
        }
    }

    var httpMethod = 'GET';
    var url = 'https://oauth.withings.com/account/access_token';
    var getData_url = nextURL(3, url, authtoken, authsecret, null, null, null);

    https.get(getData_url, function (res) {

        var data = '';
        res.on('data', function (d) {
            data += d;
        });

        res.on('end', function () {
            console.log("\n" + data + "\n");

            var token = data.split("&");
            if (token.length != 4) {
                console.log("Erratic Request");
            } else {
                var authtoken = token[0].split("=")[1];
                var authsecret = token[1].split("=")[1];
                var user = new Object();
                user["userid"] = userid;
                user["accesscred"] = new Object();
                user.accesscred["accesstoken"] = authtoken;
                user.accesscred["accesssecret"] = authsecret;
                user["lastupdate"] = 0;
                users.push(user);

                var temp = new Object;
                temp["userid"] = userid;
                temp["measures"] = new Array();
                userdata.push(temp);
            }
        });

    }).on('error', function (e) {
        console.error("ERROR: ", e);
    });
}

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    //appId: process.env.MICROSOFT_APP_ID,
    //appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
app.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector);

bot.dialog('/', [
    function (session) {
       // var text = utils.getTextWithoutMentions(session.message); // Make sure you strip mentions out before you parse the message
        var text = session.message.text;
        console.log('dialog started ' + text);
        var split = text.split(' ');

        var q = split.slice(1);

        var cmd = split[0].toLowerCase();
        var params = q.join(' ');

        // Parse the command and go do the right thing
        if (cmd.includes('view')) {
            session.beginDialog('/view');
            console.log("Hey, Just came back from view");
        } else if (cmd.includes('help')) {
            sendHelpMessage(session.message, bot, `Hi, I'm a Blood Pressure Tracker bot!!`);
        } else {
            sendHelpMessage(session.message, bot, `I'm sorry, I did not understand you :( `);
        }
    }
]);

bot.dialog('/view', [
    function (session) {

        console.log(session.message.text);

        if (session.message.text == "view") {
            session.beginDialog('/ensureUserData', session.userData.profile);


        } else {
            session.replaceDialog('/diseaseLink', {repromt: false});
        }
    }, function (session, results, next) {


        session.userData.profile = results.response;
        if (!results.available) {
            sendCardMessage(session, bot, "Please Authorize the Application", "Request again after authorizing", "Click to Authorize", results.response);
            session.endDialog();
        } else {
            next();
            // find the last reading and show it to the user
        }
    }, function (session) {
        session.beginDialog('/fetchData', session.userData.profile);
    }, function (session) {

        var userid = fetchuserid().userid;
        var currentuserdata = new Object();

        for (var i = 0; i < userdata.length; i++) {
            if (userdata[i].userid == userid) {
                currentuserdata = userdata[i];
                break;
            }
        }

        if (currentuserdata.measures.length == 0) {
            var message = "No measurements taken"
            session.endDialogWithResult({response: message});
        }
        var lastdata = currentuserdata.measures[currentuserdata.measures.length - 1];
        
        var date = lastdata.date*1000;
        var sys = null;
        var dia = null;

        for (var i = 0; i < lastdata.measures.length; i++) {
            if (lastdata.measures[i].type == 9) {
                dia = lastdata.measures[i].value;
            } else if (lastdata.measures[i].type == 10) {
                sys = lastdata.measures[i].value;
            }
        }
        
        var date_ = new Date(date).toDateString();
        var message = "Your last BP measured to be " + sys + "/" + dia + " and was taken on " + date_;

        var url = 'http://localhost:3978/static/graph.html?userid=' + userid;
        
        sendMessage(session.message, bot, message);
        sendCardMessage(session, bot, "Your Blood Pressure History", null, "Click to view history", url);
        //builder.Prompts.attachment(session, "Upload a picture for me to transform.");

        var msg = new builder.Message(session)
	                .text("Do you have any of these diseases?")
	                .suggestedActions(
		                builder.SuggestedActions.create(
				            session, [
					            builder.CardAction.imBack(session, "Diabetes", "Diabetes"),
					            builder.CardAction.imBack(session, "Kidney Problems", "Kidney Problems"),
					            builder.CardAction.imBack(session, "A", "A"),
                                builder.CardAction.imBack(session, "None", "None")
				            ]
			        ));

        session.send(msg);


        //builder.Prompts.choice(session, "Do you have any of these diseases?", "Diabetes|Kidney Problems|A|B|None");
    }, function (session, results) {
        sendMessage(session.message, bot, results.response);
        session.endDialog();
    }
]);

bot.dialog('/diseaseLink', [
    function (session) {
        console.log("You have the following disease :", session.message.text);


        var userid = fetchuserid().userid;
        var currentuserdata = new Object();

        for (var i = 0; i < userdata.length; i++) {
            if (userdata[i].userid == userid) {
                currentuserdata = userdata[i];
                break;
            }
        }

        if (currentuserdata.measures.length == 0) {
            sendMessage(session.message, bot, "No Measurements Taken Yet");
        } else {
            var lastdata = currentuserdata.measures[currentuserdata.measures.length - 1];

            var date = lastdata.date * 1000;
            var sys = null;
            var dia = null;

            for (var i = 0; i < lastdata.measures.length; i++) {
                if (lastdata.measures[i].type == 9) {
                    dia = lastdata.measures[i].value;
                } else if (lastdata.measures[i].type == 10) {
                    sys = lastdata.measures[i].value;
                }
            }

            var bptype = processbp(sys + "/" + dia);

            if (bptype == 0) {
                sendMessage(session.message, bot, "You have **low blood pressure**, probably because of **dehydration**");
            } else if (session.message.text == "Diabetes" || session.message.text == "Kidney Problems" || session.message.text == "A") {
                switch (bptype) {
                    case 1:
                        sendMessage(session.message, bot, "Your Blood Pressure is **under control**");
                        break;
                    case 2:
                        sendMessage(session.message, bot, "Your Blood Pressure is **high**");
                        break;
                    case 3:
                        sendMessage(session.message, bot, "Your Blood Pressure is **high** (Hyptertension Stage 1). Please consult your doctor");
                        break;
                    case 4:
                        sendMessage(session.message, bot, "Your Blood Pressure is **high** (Hyptertension Stage 2). Please consult your doctor ASAP");
                    case 5:
                        sendMessage(session.message, bot, "It is a case of **High Blood Pressure Crisis**. Seek **emergency care** without any further delay");
                    default:
                        sendMessage(session.message, bot, "Some problem with the software :(");
                }
            } else if (session.message.text == "None") {
                switch (bptype) {
                    case 1:
                        sendMessage(session.message, bot, "Your Blood Pressure is **under control**");
                        break;
                    case 2:
                        sendMessage(session.message, bot, "Your Blood Pressure is **normal**. Nonetheless take necessary precautions as it might shoot up");
                        break;
                    case 3:
                        sendMessage(session.message, bot, "Your Blood Pressure is **high** (Hyptertension Stage 1). Please consult your doctor");
                        break;
                    case 4:
                        sendMessage(session.message, bot, "Your Blood Pressure is **high** (Hyptertension Stage 2). Please consult your doctor ASAP");
                    case 5:
                        sendMessage(session.message, bot, "It is a case of **High Blood Pressure Crisis**. Seek **emergency care** without any further delay");
                    default:
                        sendMessage(session.message, bot, "Some problem with the software :(");
                }
            } else {
                var text = "Sorry I couldn't understand user input. Assuming that you do not have these diseases,"
                switch (bptype) {
                    case 1:
                        sendMessage(session.message, bot, text + "Your Blood Pressure is **under control**");
                        break;
                    case 2:
                        sendMessage(session.message, bot, text + "Your Blood Pressure is **normal**. Nonetheless take necessary precautions as it might shoot up");
                        break;
                    case 3:
                        sendMessage(session.message, bot, text + "Your Blood Pressure is **high** (Hyptertension Stage 1). Please consult your doctor");
                        break;
                    case 4:
                        sendMessage(session.message, bot, text + "Your Blood Pressure is **high** (Hyptertension Stage 2). Please consult your doctor ASAP");
                    case 5:
                        sendMessage(session.message, bot, text + "It is a case of **High Blood Pressure Crisis**. Seek **emergency care** without any further delay");
                    default:
                        sendMessage(session.message, bot, "Some problem with the software :(");
                }
            }
        }
        
        session.endDialog();
    }
]);

bot.dialog('/ensureUserData', [
    function (session, args, next) {
        session.dialogData.profile = args || {};
        var user = fetchuserid();
        if (!user.accesscred) {
            console.log("User does not exist in DB");
            next(session);
        } else {
            if (!user.userid) {
                next(session);
            } else {
                session.endDialogWithResult({ available: true, response: user });
            }
        }
    }, function (session) {
        var url = 'https://oauth.withings.com/account/request_token';
        var getData_url = nextURL(1, url, null, null, CALLBACK_URL, null, null);
        https.get(getData_url, function (res) {
            var data = '';
            res.on('data', function (d) {
                data += d;
            });

            res.on('end', function () {
                var token = data.split("&");
                if (token.length != 2) {
                    console.log("Erratic Request");
                } else {
                    var accesstoken = token[0].split("=")[1];
                    var accesssecret = token[1].split("=")[1];

                    var url_ = 'https://oauth.withings.com/account/authorize';
                    var getData_url_ = nextURL(2, url_, accesstoken, accesssecret, null, null, null);

                    session.endDialogWithResult({ available: false, response: getData_url_ })
                    tokens.push({
                        authtoken: accesstoken,
                        authsecret: accesssecret
                    });
                }
            });

        }).on('error', function (e) {
            console.error("ERROR: ", e);
        });
    }
]);

bot.dialog('/fetchData', [
    function (session, user, next) {

        //console.log(user);

        var url = 'https://wbsapi.withings.net/measure';
        var getData_url = nextURL(4, url, user.accesscred.accesstoken, user.accesscred.accesssecret, null, user.userid, user.lastupdate);

        console.log(getData_url);

        https.get(getData_url, function (res) {
            var data = '';
            res.on('data', function (d) {
                data += d;
            });

            res.on('end', function () {

                data = JSON.parse(data);                

                var userdata_array = new Array();
                for (var i = 0; i < userdata.length; i++) {
                    if (userdata[i].userid == user.userid) {
                        userdata_array = userdata[i].measures;
                        break;
                    }
                }

                for (var i = data.body.measuregrps.length - 1; i >= 0; i--) {
                    var temp = new Object();
                    temp["date"] = data.body.measuregrps[i].date;
                    temp["measures"] = data.body.measuregrps[i].measures;
                   
                    var flag = 0
                    for (var j = 0; j < temp.measures.length; j++) {
                        if (temp.measures[j].type == 9 || temp.measures[j].type == 10) {
                            flag = 1;
                        }
                    }
                    if (flag == 1) {
                        userdata_array.push(temp);
                    }
                }

                console.log(data.body.measuregrps.length + " readings added now");

                for (var i = 0; i < users.length; i++) {
                    if (users[i].userid == user.userid) {
                        users[i].lastupdate = data.body.updatetime;
                        userdata[i].measures = userdata_array;
                        break;
                    }
                }

                session.endDialog();
            });

        }).on('error', function (e) {
            console.error("ERROR: ", e);
        });
        // Given the user details fetch the data.
        // Store it in a temp json file
        // Load the url and send a card with a button 
    }
]);

bot.on('conversationUpdate', (msg) => {
    console.log("Hey:",msg);
    console.log('Sample app was added to the team');
    //if (!msg.eventType === 'teamMemberAdded') return;
    if (!Array.isArray(msg.membersAdded) || msg.membersAdded.length < 1) return;
    var members = msg.membersAdded;

    // Loop through all members that were just added to the team
    for (var i = 0; i < members.length; i++) {

        // See if the member added was our bot
        if (members[i].name.includes('Bot') ) {
            sendHelpMessage(msg, bot, `Hi, I'm a Blood Pressure Tracker bot!!`);
        }
    }
});

function fetchuserid() {
    var userid = 13618522;
    var user = new Object();
    for (var i = 0; i < users.length; i++) {
        if (users[i].userid == userid) {
            user = users[i];
            break;
        }
    }
    return user;
}

// Helper method to send a text message
function sendMessage(message, bot, text) {
    var msg = new builder.Message()
		.address(message.address)
		.textFormat(builder.TextFormat.markdown)
		.text(text);

    bot.send(msg, function (err) { });
}

// Helper method to send a generic help message
function sendHelpMessage(message, bot, firstLine) {
    var text = `##${firstLine} \n\n Here's what I can help you do \n\n`
    text += `To view your Blood Pressure readings, you can type **view**\n\n`;

    sendMessage(message, bot, text);
}

// Helper method to generate a card message for a given task.
function sendCardMessage(session, bot, title, text, button, url) {

    var card = new builder.ThumbnailCard()
		.title(title)
        .text(text)
		.buttons([
			builder.CardAction.openUrl(null, url, button)
		]);

    var msg = new builder.Message()
		.address(session.message.address)
		.textFormat(builder.TextFormat.markdown)
		.addAttachment(card);

    bot.send(msg, function (err, addresses) {
        if (addresses && addresses.length > 0) {
            
        }
    });
}
/* Tested */
function processbp(bp) { 
    var parsedbp = bp.split("/"); // The value of the BP is assumed to be of the form (Systolic BP)/(Diastolic BP)
    if (parsedbp.length != 2) {
        // Report an Error
        console.log("Wrong Format")
        return 6;
    } else {
        for (var i = 0; i < parsedbp.length; i++) {
            parsedbp[i] = parseInt(parsedbp[i]);
        }

        /**********************************
        Encoding Scheme : 
        For Systolic Blood Pressure :
        0 -- <80
        1 -- 80 - 99
        2 -- 100 - 119
        3 -- 120 - 139
        4 -- 140 - 159
        5 -- 160 - 179
        6 -- >179

        For Diastolic Blood Pressure :
        0 -- <60
        1 -- 60 - 69
        2 -- 70 - 79
        3 -- 80 - 89
        4 -- 90 - 99
        5 -- 100 - 109
        6 -- >109
        ***********************************/
        var encodedsysbp = Math.floor((parsedbp[0] - 60) / 20);
        var encodeddiabp = Math.floor((parsedbp[1] - 50) / 10);

        encodeddiabp = (encodeddiabp<1)? 0 : encodeddiabp;
        encodedsysbp = (encodedsysbp<1)? 0 : encodedsysbp;
        
        encodeddiabp = (encodeddiabp>5)? 6 : encodeddiabp;
        encodedsysbp = (encodedsysbp>5)? 6 : encodedsysbp;

        if ((encodeddiabp == 1 || encodeddiabp == 2) && (encodedsysbp == 1 || encodedsysbp == 2)) {
            // Report Normal BP
            console.log("Normal BP");
            return 1;
        } else if (encodeddiabp == 0 || encodedsysbp == 0) {
            // Report Low Blood Pressure (Hypotension)
            console.log("Low Blood Pressure (Hypotension)");
            return 0;
        } else {
            var temp = (encodedsysbp > encodeddiabp) ? encodedsysbp : encodeddiabp;
            return temp - 1;
            //console.log("temp is ", temp);
            switch (temp) {
                case 3:
                    // Report Prehypertension
                    console.log("Prehypertension");
                    break;
                case 4:
                    // Report High Blood Pressure (Hypertension Stage 1)
                    console.log("High Blood Pressure (Hypertension Stage 1)");
                    break;
                case 5:
                    // Report High Blood Pressure (Hypertension Stage 2)
                    console.log("High Blood Pressure (Hypertension Stage 2)");
                    break;
                case 6:
                    // Report High Blood Pressure Crisis (Emergency Care)
                    console.log("High Blood Pressure Crisis (Emergency Care)");
                    break;
                default:
                    // Report Error
                    console.log("Some Error");
                    break;
            }
        }
    }
}