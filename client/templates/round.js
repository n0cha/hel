Template.round.helpers({
	number: function () {
		return Round.number();
	},
	started: function () {
		return Round.started();
	},
	points: function () {
		return Round.points();
	},
	todo: function () {
		var status = Player().status();
		if (!Round.number()) {
			switch (status) {
				case Player.STATUS.CREATE:
					return 'Create your army';
				case Player.STATUS.SELECT:
					return 'Select your army';
				case Player.STATUS.COLOR:
					return 'Select a color';
				case Player.STATUS.ICON:
					return 'Select an icon';
			}
		}
		if (!Round.started() && status === Player.STATUS.SUBMIT) {
			return 'Submit your army list' + (Round.number() > 1 ? '. Don\'t forget your ' + (Round.points() / 5) + 'pt mercenary force!' : '');
		}
		if (Round.number() && status === Player.STATUS.DECLARE) {
			return 'Declare your attack';
		}
		if (Round.playersNotDone().length) {
			return 'You\'re done! Nothing to do but wait for the other players...';
		}
		return 'Everyone\'s done! Go ahead and click on "Start Round".';
	},
	done: function () {
		return !Round.playersNotDone().length;
	}
});

Template.round.events({
	'click #resetGame': function () {
		Map.clear();
		Round.reset();
	},
	'click #startGame': function () {
		Map.create();
		Map.populate();
		Round.next();
	},
	'click #nextRound': function () {
		Round.next();
	},
	'click #startRound': function () {
		Round.start();
	}
});

Template.waiting.helpers({
	playersNotDone: function () {
		return Round.playersNotDone();
	},
	userName: function () {
		return Meteor.userId() === this.userId ? 'You' : Meteor.users.findOne({_id: this.userId}).username;
	},
	icon: function () {
		return Icon(this.icon);
	},
	regionCount: function () {
		return regions.find({owner: this._id}).count();
	}
});
