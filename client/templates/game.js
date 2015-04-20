var hexWidth = 60;
var hexHeight = 45;

var padLeft = function (s) {
	if (s.length === 1) {
		s = '0' + s;
	}
	return s;
};

var lighten = function (color) {
	var rgb = /^#([\da-f]{1,2})([\da-f]{1,2})([\da-f]{1,2})$/.exec(color);
	var r = '#';
	
	_.each(_.range(1, 4), function (i) {
		if (color.length === 4) {
			rgb[i] = rgb[i] + rgb[i];
		}
		r += padLeft(Math.round((parseInt(rgb[i], 16) + 255) / 2).toString(16));
	});
	
	return r;
};

Template.game.events({
	'click #nextRound': function () {
		rounds.insert({});
	}
});

Template.game.helpers({
	roundStarted: function () {
		return Round.started();
	},
	gameStarted: function () {
		return !!Round.number();
	}
});

Template.map.helpers({
	width: function () {
		return (Map.getWidth() - Map.getXMin()) * hexWidth;
	},
	height: function () {
		return Map.getHeight() * hexHeight + hexHeight / 3;
	},
	region: function () {
		return regions.find();
	},
	points: function () {
		var points = [];
		//var y = this.y;
		//var x = this.x * hexWidth;
		var step = hexWidth / 4;
		//var isEvenRow = !(y % 2);
		//y *= hexHeight;
		//if (isEvenRow) {
		//	x += 2 * step;
		//}

		points.push([0, step]);
		points.push([2 * step, 0]);
		points.push([4 * step, step]);
		points.push([4 * step, 3 * step]);
		points.push([2 * step, 4 * step]);
		points.push([0, 3 * step]);

		return _(points).map(function (p) {return p.join(',');}).join(' ');
	},
	color: function () {
		var player = players.findOne({_id: this.owner});
		var color = player && player.color || '#fff';
		if (this.owner !== Player().id()) {
			color = lighten(color);
		}
		return color;
	},
	anchorX: function () {
		var y = this.y;
		var x = (this.x - Map.getXMin()) * hexWidth;
		var isEvenRow = !(y % 2);
		if (isEvenRow) {
			x += hexWidth / 2;
		}
		return x;
	},
	anchorY: function () {
		var y = this.y;
		y *= hexHeight;
		return y/* + hexHeight / 1.5*/;
	},
	id: function () {
		return this._id;
	},
	owned: function () {
		return this.owner === Player().id() ? 1 : 0;
	},
	attacking: function () {
		return Player().attack() === this._id ? 1 : 0;
	},
	attackable: function () {
		return _.contains(Player().attackableRegions(), this._id);
	},
	capital: function () {
		var player = players.findOne({capital: this._id});
		if (player) {
			var icon = images.findOne({_id: player.icon});
		}
		return player && icon && icon.data;
	},
	attackRegion: function () {
		return Player().attackedRegion().name;
	},
	defenderName: function () {
		return Player().attackedPlayer().armyName();
	},
	defenderArmy: function () {
		return Player().attackedPlayer().armyBook();
	},
	defenderColor: function () {
		return Player().attackedPlayer().color();
	}
});

Template.map.rendered = function () {
	if (Player().canAttack()) {
		_.each(Player().attackableRegions(), function (id) {
			$('#map .region[data-id="' + id + '"')
					.attr('data-attackable', 1)
					.click(function () {
						Player().attack(id);
					})
			;
		});
	}
};

Template.battles.events({
	'click #iWon': function () {
		Meteor.call('setWinner', this.regionId, Round.number(), Player().id());
	},
	'click #didntWin': function () {
		Meteor.call('setWinner', this.regionId, Round.number(), '');
	}
});

Template.battles.helpers({
	battles: function () {
		//var _battles = battles.aggregate([{$group: {_id: '$region', defender: {$first: '$defender'}, attackers: {$addToSet: '$attacker'}}}]).fetch();
		var _battles = {};
		var getPlayer = function (id, role, winner) {
			return _.extend(players.findOne({_id: id}) || {}, {
				role: role,
				winner: winner,
				score: regions.find({owner: id}).count()
			});
		};
		//var i = 0;

		battles.find({round: Round.number()}).forEach(function (b) {
			if (!_battles[b.region]) {
				_battles[b.region] = {
					//number: ++i,
					regionId: b.region,
					region: (regions.findOne({_id: b.region}) || {}).name,
					players: [getPlayer(b.defender, 'defender', b.winner && b.winner === b.defender)],
					winner: b.winner
				};
			}
			_battles[b.region].players.unshift(getPlayer(b.attacker, 'attacker', b.winner && b.winner === b.attacker));
			var ps = _battles[b.region].players;
			var lowest = _.min(_.pluck(ps, 'score'));
			var highest = _.max(_.pluck(ps, 'score'));
			_battles[b.region].players = _.map(ps, function (p) {
				p.underdog = (p.score === lowest && p.score < highest);
				return p;
			});
		});

		return _.toArray(_battles);
	},
	userName: function () {
		return Meteor.users.findOne({_id: this.userId}).username;
	},
	winnerIsMe: function () {
		return this.winner === Player().id();
	},
	iCanWin: function () {
		return !this.winner && _.contains(_.pluck(this.players, '_id'), Player().id());
	},
	me: function () {
		return this._id === Player().id() ? 'me' : '';
	},
	isWinner: function () {
		return this.winner === false ? 'loser' : this.winner ? 'winner' : '';
	},
	planLink: function () {
		var title = encodeURIComponent('Battle of ' + this.region);
		var desc = encodeURIComponent(_.reduce(this.players, function (m, p) {
			return m + p.role + ': ' + p.armyName + ' (' + p.army + ') - ' + Meteor.users.findOne({_id: p.userId}).username + (p.underdog ? ' [Underdog Support]' : '') + '\n';
		}, ''));
		var player = encodeURIComponent(Meteor.users.findOne({_id: Meteor.userId()}).username);
		var location = encodeURIComponent('Joost\'s place');
		return 'http://doodle.com/create?type=date&title=' + title + '&location=' + location + '&description=' + desc + '&name=' + player;
	}
});
