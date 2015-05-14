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
		return players.findOne({userId: this.userId}).color;
	},
	icon: function () {
		return Player(players.findOne({userId: this.userId})._id).icon();
	},
	time: function () {
		return this.time && moment(this.time).fromNow() || '';
	}
});

Template.chat.events({
	'keypress #chatinput': function (e) {
		if (e.keyCode === 13) {
			e.preventDefault();
			var message = $(e.target).text().trim();
			if (message) {
				chatMessages.insert({userId: Meteor.userId(), message: message, time: new Date()});
			}
			e.target.innerHTML = '';
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
	$('#chatinput').focus();
};
