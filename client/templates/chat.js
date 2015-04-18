Template.chat.helpers({
	chatMessages: function () {
		var messages = chatMessages.find();
		messages.observe({
			added: function () {
				var $chatbox = $('#chatbox');
				$chatbox.stop().animate({scrollTop: $chatbox.prop('scrollHeight')}, 500);
			}
		});
		return messages;
	},
	userName: function () {
		return Meteor.users.findOne({_id: this.userId}).username;
	},
	time: function () {
		return this.time && moment(this.time).fromNow() || '';
	}
});

Template.chat.events({
	'keypress #chatinput': function (e) {
		var message = $(e.target).text().trim();
		if (e.keyCode === 13 && message) {
			chatMessages.insert({userId: Meteor.userId(), message: message, time: new Date()});
			$(e.target).text('');
		}
	}
});

Template.chat.rendered = function () {
	var $chatbox = $('#chatbox');
	var $chatinput = $('#chatinput');
	var margins = $chatbox.outerHeight(true) - $chatbox.height();
	var resizeChatbox = function () {
		$chatbox.height($(window).height() - $chatbox.offset().top - margins - $chatinput.outerHeight(true));
	}
	$(window)
			.on('resize', resizeChatbox)
			.on('scroll', resizeChatbox)
	;
	resizeChatbox();

	$chatbox.stop().animate({scrollTop: $chatbox.prop('scrollHeight')}, 0);
	$chatinput.focus();
};
