function Client(ip, username, auth)
{
	this.username = username;
	this.nick = username;
	this.ip = ip;
	this.auth = auth;
	this.msgs = [];
	this.topics = {};
	this.client = new irc.Client('irc.freenode.net', username);
	this.last_received = new Date().getTime();
	var client = this.client;
	var user = this;
	
	client.addListener('message', function (from, to, message) {
		console.log(user.username + ":\tIN  [" + to + "] " + from + ': ' + message);
		user.msgs.push({channel: to, user: from, msg: message});
	});
	
	client.addListener('notice', function (from, to, message) {
		if (from == null)
			return;
		console.log(user.username + ":\tNOT [" + to + "] " + from + ': ' + message);
		user.msgs.push({channel: to, user: from, msg: message, type: "notice"});
	});
	
	client.addListener('error', function(message) {
		console.log(user.username + ':\tError: ', message);
	});
	
	client.addListener('join', function(channel, nick) {
		if (user.nick == nick) {
			console.log(user.username +  ":\tJoined " + channel);
			user.msgs.push({channel: channel, type: "null"});
			if (!user.topics[channel]) {
				user.topics[channel] = "";
			}
		} else {
			user.msgs.push({channel: channel, user: nick, type: "join"});
		}
	});
	
	client.addListener('ctcp', function(from, to, text, type) {
		if (text.lastIndexOf("ACTION") === 0) {
			var message = text.substring(6);
			console.log(user.username + ":\tIN  [" + to + "] " + from + ' ' + message);
			user.msgs.push({channel: to, user: from, msg: message, type: "action"});
		} else {		
			console.log(user.username + ":\tctcp: " + from + ", "+ to + ", "+text+", "+type);
		}
	})
	
	client.addListener('ctcp-version', function(from, to) {
		user.client.ctcp(from, "VERSION", "rubenwardy's IRC client on " + os.type() + " " + os.release() + " " + os.arch());
		user.msgs.push({channel: "%cur", user: from, msg: "ctcp version", type: "notice"});
	});

	client.addListener('topic', function(channel, topic) {
		user.topics[channel] = topic;
		user.msgs.push({user: "@"+channel, msg: topic, channel: channel});
	});
}


Client.prototype.handle = function(data)
{
	this.last_received = new Date().getTime();
	
	if (data.id == "send" && data.msg && data.msg != "") {
		if (data.msg[0] == "/" && (data.msg.length == 1 || data.msg[1] != "/")) {
			// Do Command
			if (data.msg.lastIndexOf("/join") === 0) {
				this.client.join(data.msg.substring(5).trim());
			} else if (data.msg.lastIndexOf("/me") === 0) {
				console.log(this.username + ":\tOUT [" + data.target + "] " + this.username + " " + data.msg);
				this.client.action(data.target, data.msg.substring(3).trim());
				this.msgs.push({channel: data.target, user: this.username, msg: data.msg.substring(3).trim(), type: "action"});
			} else {
				console.log(this.username + ":\tCommand not recognised: " + data.msg.trim());
				this.msgs.push({user: "@client", msg: "Command not recognised!", channel: data.target});
			}
		} else {
			if (data.target && data.target != "") {
				// Say
				console.log(this.username + ":\tOUT [" + data.target + "] " + this.username + ": " + data.msg);
				this.client.say(data.target, data.msg);
				this.msgs.push({channel: data.target, user: this.username, msg: data.msg});
			}
		}
	} else if (data.id == "reconnect") {
		console.log("Client reconnected [" + data.ip + "]");
		for (var chan in this.topics) {
			console.log(" - " + chan);
			if (this.topics[chan] != "")
				this.msgs.push({user: "@"+chan, msg: this.topics[chan], channel: chan});
			else
				this.msgs.push({channel: chan});
		}
		
	}
	var tmp = this.msgs;
	this.msgs = [];
	return {msgs: tmp};
	
};

Client.prototype.disconnect = function()
{
	this.client.disconnect();
};

console.log("rubenwardy's IRC proxy server");
var irc = require('irc');
var os = require('os');
var clients = {};

setInterval(function() {
	for (var username in clients) {
		var client = clients[username];
		if (client && new Date().getTime() > client.last_received + 5000) {
			console.log(username + " timed out!");
			client.disconnect();
			delete clients[username];
		}
		
	}
}, 1000);

/*
	Handle
*/
var http = require("http");
var url = require("url");
http.createServer(function(req, out) {
	try {
		var data = "";
		req.on('data', function(chunk) {
			//to + ': '  append the current chunk of data to the fullBody variable
			data += chunk.toString();
		});
		req.on('end', function() {
			var ip = req.connection.remoteAddress;
			try {
				var json = JSON.parse(data);
				json.ip = ip;
				var username = json.user;
				
				if (!username || username == null || username == "")
					return;
					
				var user = clients[username];
				
				if (!user) {
					console.log("Client " + username + " Connected [" + ip + "]");
					user = new Client(json.ip, username, "abc");
					clients[username] = user;
					if (json.id == "reconnect")
						return;
				}
				
				out.writeHead(200, {"Content-Type": "text/plain","Access-Control-Allow-Origin":"*"});
				out.write( JSON.stringify( user.handle(json) ) );
				out.end();
			} catch(e) {
				if (e.stack)
					console.log(e.stack);
				out.writeHead(200, {"Content-Type": "text/plain","Access-Control-Allow-Origin":"*"});
				out.write( JSON.stringify({status: "error", what: e.message}) );
				out.end();
			}	
		});
	} catch(e) {
		if (e.stack)
			console.log(e.stack);
		out.writeHead(200, {"Content-Type": "text/plain","Access-Control-Allow-Origin":"*"});
		out.write( JSON.stringify({status: "error", what: e.message}) );
		out.end();
	}
}).listen(8888);