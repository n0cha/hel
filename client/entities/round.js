var gameLength = 5;

Round = {
	pointIncrement: 500,

	_get: function () {
		return rounds.findOne({}, {sort: {number: -1}}) || {
					number: 0,
					started: false
				};
	},
	number: function () {
		return this._get().number;
	},
	started: function () {
		return this._get().started;
	},
	points: function () {
		return (this._get().number || 1) * this.pointIncrement;
	},
	next: function () {
		battles.find({round: this.number()}).forEach(function (battle) {
			var capital = players.findOne({capital: battle.region});
			if (capital && capital._id !== battle.winner) {
				// player lost capital
				Player(capital._id).capital(regions.findOne({owner: capital._id})._id);
			}
			regions.update({_id: battle.region}, {$set: {owner: battle.winner}}, {multi: true});
		});
		if (this.number() < gameLength) {
			rounds.insert({number: this.number() + 1, started: false});
		}
		Session.set('attackRegionId', undefined);
		Session.set('showArmyList', undefined);
	},
	start: function () {
		if (this.number() > 0 && !this.started()) {
			rounds.update({_id: this._get()._id}, {$set: {started: true}});
		}
	},
	reset: function () {
		Meteor.call('clearRounds');
		Meteor.call('clearArmyLists');
		Session.set('attackRegionId', undefined);
	},
	playersNotDone: function () {
		var gameStarted = !!this.number(),
				roundStarted = this.started();

		return _.filter(players.find().fetch(), function (player) {
			var p = Player(player._id);

			if (gameStarted) {
				if (roundStarted) {
					return p.status() < Player.STATUS.DONE;
				} else {
					return p.status() < Player.STATUS.BATTLE;
				}
			} else {
				return p.status() < Player.STATUS.DECLARE;
			}
		});
	}
};
