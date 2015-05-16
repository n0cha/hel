Template.chat.helpers({
	chatMessages: function () {
		var messages = chatMessages.find();
		messages.observe({
			added: function () {
				var $body = $(document.body);
				$body.stop().animate({scrollTop: $body.prop('scrollHeight')}, 500);
			}
		});
		return messages;
	},
	userName: function () {
		return Meteor.users.findOne({_id: this.userId}).username;
	},
	color: function () {
		return Player(players.findOne({userId: this.userId})._id).lightenedColor();
	},
	icon: function () {
		return Player(players.findOne({userId: this.userId})._id).icon();
	},
	time: function () {
		return this.time && moment(this.time).fromNow() || '';
	}
});

Template.chat.events({
	'keyup #chatinput': function (e) {
		var message = $(e.target).text();
		if (e.keyCode === 13) {
			e.preventDefault();
			message = message.trim();
			if (message) {
				chatMessages.insert({userId: Meteor.userId(), message: message, time: new Date()});
			}
			e.target.innerHTML = '';
			//Session.set('currentChatMessage', '');
		} else {
			//Session.set('currentChatMessage', message);
		}
	}
});

Template.chat.rendered = function () {
	//var $chatbox = $('#chatbox');
	//var $chatinput = $('#chatinput');
	//var margins = $chatbox.outerHeight(true) - $chatbox.height();
	//var resizeChatbox = function () {
	//	$chatbox.height($(window).height() - margins - $('#bannerContainer').offset().top - $chatinput.outerHeight(true));
	//}
	//$(window)
	//		.on('resize', resizeChatbox)
	//		.on('scroll', resizeChatbox)
	//;
	//resizeChatbox();
	
	var $body = $(document.body);
	$body.stop().animate({scrollTop: $body.prop('scrollHeight')}, 0);
	$('#chatinput')
			//.text(Session.get('currentChatMessage'))
			.focus()
	;
};
