Player = function (playerId) {
	if (!playerId) {
		var player = players.findOne({userId: Meteor.userId()});
		playerId = player && playerId;
	}
	return {
		_get: function () {
			return players.findOne({_id: playerId}) || {};
		},
		_update: function (fields) {
			players.update(playerId, {$set: fields});
		},
		create: function () {
			playerId = players.insert({userId: Meteor.userId(), army: 0});
		},
		armyBook: function (army) {
			if (army) {
				this._update({army: army});
			} else {
				return this._get().army;
			}
		},
		armyList: function (data) {
			var round = Round.number() || 1;
			if (typeof data === 'string') {
				Meteor.call('setArmyList', playerId, round, data);
			} else {
				return (armyLists.findOne({player: playerId, round: round}) || {}).list || '';
			}
		},
		armyName: function (name) {
			if (name) {
				this._update({armyName: name});
			} else {
				return this._get().armyName;
			}
		},
		regions: function () {
			return regions.find({owner: this._get()._id}).fetch();
		},
		attackableRegions: function () {
			return _.uniq(_.reduce(this.regions(), function (result, r) {
				return result.concat(_.pluck(_.filter(Map.getAdjacentRegions(r.x, r.y), function (r) {
					return r.owner !== playerId;
				}), '_id'));
			}, [], this));
		},
		id: function () {
			return playerId;
		},
		canAttack: function () {
			return Round.number() && !Round.started() && (this.status() === Player.STATUS.DECLARE || this.status() === Player.STATUS.BATTLE);			
		},
		attack: function (regionId) {
			if (regionId) {
				if (this.canAttack()) {
					Session.set('attackRegionId', regionId);
					Meteor.call('setAttack', regionId, playerId, regions.findOne({_id: regionId}).owner, Round.number());
				}
			} else {
				var battle = battles.findOne({round: Round.number(), attacker: this._get()._id});
				var dummy = Session.get('attackRegionId');
				return battle && battle.region;
			}
		},
		color: function (color) {
			if (color) {
				this._update({color: color});
			} else {
				return this._get().color || '#ffffff';
			}
		},
		icon: function (data) {
			var imageId = this._get().icon;
			if (data) {
				if (imageId) {
					images.remove({_id: imageId});
				}
				imageId = images.insert({data: data});
				this._update({icon: imageId});
			} else {
				if (imageId) {
					var image = images.findOne({_id: imageId});
					return image && image.data;
				}
			}
		},
		status: function () {
			if (!playerId) {
				return Player.STATUS.CREATE;
			}
			var player = this._get();
			if (!player.army) {
				return Player.STATUS.SELECT;
			}
			if (!player.color) {
				return Player.STATUS.COLOR;
			}
			if (!player.icon) {
				return Player.STATUS.ICON;
			}
			var armyList = armyLists.findOne({player: playerId, round: Round.number() || 1});
			if (!armyList) {
				return Player.STATUS.SUBMIT;
			}
			var battle = battles.findOne({round: Round.number(), attacker: playerId});
			if (!battle) {
				return Player.STATUS.DECLARE;
			}
			var _battles = battles.find({winner: '', $or: [{attacker: playerId}, {defender: playerId}]}).count();
			if (_battles) {
				return Player.STATUS.BATTLE;
			}
			return Player.STATUS.DONE;
		},
		capital: function (region) {
			if (region) {
				this._update({capital: region});
			} else {
				return this._get().capital;
			}
		}		,
		attackedRegion: function () {
			return regions.findOne({_id: this.attack()}) || {};
		},
		attackedPlayer: function () {
			return Player(this.attackedRegion().owner);
		}
	};
};

Player.STATUS = {
	CREATE: 0,
	SELECT: 1,
	COLOR: 2,
	ICON: 3,
	SUBMIT: 4,
	DECLARE: 5,
	BATTLE: 6,
	DONE: 7
};
