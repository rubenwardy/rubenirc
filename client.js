var PANEL_HEIGHT = 120;
var last_send = 0;
var last_receive = 0;
var channels = [];
var current_channel = -1;
var username = "";
function send(msg) {	
	if (msg == "")
		return;
	
	if (msg[0] == "/") {
		if (msg.lastIndexOf("/help") === 0) {
			$("#help").fadeIn();
			return;
		}
	}
	
	var tosend = JSON.stringify({
		user: username,
		id: "send",
		target: getChannelI(current_channel),
		msg: msg
	});
	$.ajax({
		url: "http://" + SERVER_ADDRESS,
		dataType: "json",
		type: "POST",
		data: tosend,
		timeout: 2500
	}).done(function(data) {
		doMsgs(data);
	});		
}

function init()
{
	last_send = new Date().getTime();
	last_receive = new Date().getTime();
	$("#send").click(function() { send($("#msg").val()); $("#msg").val(""); });
	$("#close_help").click(function(){ $("#help").fadeOut(); });
	
	// Connect
	$.ajax({
		url: "http://" + SERVER_ADDRESS,
		dataType: "json",
		type: "POST",
		data: JSON.stringify({user: username, id: "reconnect"}),
		timeout: 2500
	}).done(function(data) {
		doMsgs(data);
	});
	
	// Start ticking
	setInterval(tick, 1000/60);
	
	$("#msg").keyup(function(event){
		if(event.keyCode == 13){
			$("#send").click();
		}
	});
}

function getChannelI(id)
{
	if (id < 0 || channels.length <= id)
		return null;
	return channels[id].name;	
}

function getChannel(name) {
	for (var i = 0; i < channels.length; i++) {
		if (channels[i].name == name)
			return channels[i];
	}
	return null;
}

function switchTo(name) {
	for (var i = 0; i < channels.length; i++) {
		if (channels[i].name == name) {
			console.log("Switching to " + name);
			current_channel = i;
			var safe_c_name = name.replace("##", "UNOFFICIAL_").replace("#", "").replace("(", "__").replace(")", "__");
			$(".channel").removeClass("channel_highlight");
			$("#channel_"+safe_c_name).addClass("channel_highlight");
			return;
		}
	}	
	console.log("Failed to switch to " + name);
}

function pushUp(by)
{
	for (var i = 0; i < channels.length; i++) {
		for (var j = 0; j < channels[i].messages.length; j++) {
			channels[i].messages[j].y += by;
		}
	}
}
var id = 0;
function updateIRC()
{
	last_send = new Date().getTime();
	$.ajax({
		url: "http://" + SERVER_ADDRESS,
		dataType: "json",
		type: "POST",
		data: JSON.stringify({user: username}),
		timeout: 2500
	}).done(function(data) {
		doMsgs(data);
		last_receive = new Date().getTime();
	});
	
}

function doMsgs(data)
{
	for (var i = 0; i < data.msgs.length; i++) {
		doMsg(data.msgs[i]);
	}
}

function doMsg(msg) {
	console.log(msg);
	
	// Correct channel names when in private chat
	if (msg.channel == username) {
		msg.channel = msg.user;
	}
	if (msg.channel == "%cur") {
		msg.channel = getChannelI(current_channel);
	}
	if (msg.type == "notice") {
		if (msg.user == null)
			msg.user = "@server";
		if (msg.channel == "*")
			msg.channel = "(server)";
	}
		
	// Get channel names
	var channel = getChannel(msg.channel);
	var safe_c_name = msg.channel.replace("##", "UNOFFICIAL_").replace("#", "").replace("(", "__").replace(")", "__");
	
	// Create channel
	if (!channel) {
		channel = {name: msg.channel, messages: []};
		$("#chats").append("<div id=\"channel_"+safe_c_name+"\" class=\"channel\"><h2 class=\"channel_title\">"+msg.channel+"</h2></div>");
		$("#channel_"+safe_c_name).click(function(){ switchTo(channel.name); });
		channels.push(channel);
	}
	if (current_channel == -1)
		switchTo(msg.channel);
	if (msg.type == "null" || !msg.user)
		return;
	
	// Add msg to channel
	var date = new Date();
	var time = date.getHours() + ":" + (date.getMinutes()<10?"0":"") + date.getMinutes() + ":" + (date.getSeconds()<10?"0":"") + date.getSeconds();
	if (msg.type == "join") {
		var tmp = "<div id=\"msg_" + id + "\" class=\"msg msgnobox\">";
		tmp    += "<h3>" + msg.user + "</h3>";
		tmp    += "<p>entered the channel</p>";		
		tmp    += "<span class=\"channel_lbl\">" + time + "</span></div>";
		$("#channel_"+safe_c_name).append(tmp);
	} else {
		var is_service = (msg.user[0]=="@");
		var tmp = "<div id=\"msg_" + id + "\" class=\"msg\">";
		if (is_service) {
			tmp += "<span class=\"channel_lbl\">" + msg.user.substring(1) + "</span>";
		} else {
			tmp += "<h3>" + msg.user + "</h3>";
			tmp += "<span class=\"channel_lbl\">" + time + "</span>";
		}
		tmp     += "<p>" + msg.msg + "</p></div>";
		$("#channel_"+safe_c_name).append(tmp);
	}
	
	// Move messages
	var msge = $("#msg_"+id);
	var height = $(window).height() - PANEL_HEIGHT;
	msge.css({top: (height - msge.height()) + "px"});
	if (channel.messages.length > 0) {
		var lmsg = channel.messages[channel.messages.length - 1];
		if (lmsg.y < msge.height() + 30)
			pushUp(msge.height() + 30 - lmsg.y);
	}
	channel.messages.push({user:msg.user, msg:msg.msg, y:0, id: id, notice:msg.notice});
	id++;
}

last = new Date().getTime();
function tick()
{
	var dtime = (new Date().getTime() - last) / 1000;
	if ((last_send == 0 || last_receive >= last_send) && new Date().getTime() > last_receive + 100) {
		updateIRC();
	}
	
	var height = $(window).height() - PANEL_HEIGHT;
	
	$(".channel_title").css({top: (height + 20) + "px"});
	for (var i = 0; i < channels.length; i++) {
		for (var j = 0; j < channels[i].messages.length; j++) {
			var msg = channels[i].messages[j];
			msg.y += dtime * 10;
			var msge = $("#msg_" + msg.id);
			msge.css({top: (height - msg.y - msge.height()) + "px"});
		}
		while (channels[i].messages.length > 0 && channels[i].messages[0].y > height + 100) {
			var msg = channels[i].messages.shift();
			$("#msg_" + msg.id).remove();
		}
	}
	
	last = new Date().getTime();
	
}

$(function() {
	$("#connect").click(function() {
		$("#chats").show();
		$("#msgbox").show();
		$("#login").fadeOut();
		$("#credit").hide();
		username = $("#username").val();
		init();
		if ($("#tb_channels").val() != "")
			setTimeout(function() { send ("/join "+$("#tb_channels").val());}, 500);
	});
});