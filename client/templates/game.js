var hexWidth = 60;
var hexHeight = 45;

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
		var step = hexWidth / 4;

		points.push([0, step]);
		points.push([2 * step, 0]);
		points.push([4 * step, step]);
		points.push([4 * step, 3 * step]);
		points.push([2 * step, 4 * step]);
		points.push([0, 3 * step]);

		return _(points).map(function (p) {return p.join(',');}).join(' ');
	},
	color: function () {
		var color;
		if (this.owner !== Player().id()) {
			color = Player(this.owner).lightenedColor();
		} else {
			color = Player(this.owner).color();
		}
		return color;
	},
	fullColor: function () {
		return Player(this.owner).color();
	},
	anchorX: function () {
		var y = this.y;
		var x = (this.x - Map.getXMin());
		return (x + (y / 2)) * hexWidth;
	},
	anchorY: function () {
		return this.y * hexHeight;
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
	portal: function () {
		var portal = portals.findOne({x: this.x, y: this.y});
		return portal;
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
	},
	selectedRegion: function () {
		var regionId = Session.get('selectedRegion');
		return regionId && regions.findOne({_id: regionId}).name || '';
	}
});

Template.map.rendered = function () {
	$('#map .region').each(function () {
		$(this).hover(function () {
			$('#mapTooltip')
					.css({top: $(this).position().top + hexHeight, left: $(this).position().left + hexWidth})
					.show()
			;
			Session.set('selectedRegion', $(this).attr('data-id'));
		}, function () {
			Session.set('selectedRegion', undefined);
			$('#mapTooltip').hide();
		});
	});
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

		battles.find({round: Round.number()}).forEach(function (b) {
			if (!_battles[b.region]) {
				_battles[b.region] = {
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
