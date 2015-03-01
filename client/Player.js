var Player = function (id) {
	id = id || players.findOne({userId: Meteor.userId()})._id;
	return {
		_get: function () {
			return players.findOne({_id: id}) || {};
		},
		_update: function (fields) {
			players.update(id, {$set: fields});
		},
		create: function () {
			id = players.insert({userId: Meteor.userId(), army: 0});
		},
		armyBook: function (army) {
			if (army) {
				this._update({army: army});
			} else {
				return this._get().army;
			}
		},
		armyList: function (data) {
			if (data) {
				Meteor.setArmyList(id, round, data);
				var army = this.armyList()._id;
				if (army) {
					armyLists.update(army, {list: data});
				} else {
					armyLists.insert({player: this._get()._id, round: Round.number() || 1, list: data});
				}
			} else {
				return (armyLists.findOne({player: id, round: Round.number() || 1}) || {}).list || '';
			}
		},
		setArmyList: function (data) {
		},
		setArmyName: function (name) {
			this._update({armyName: name});
		},
		getArmyName: function () {
			return this._get().armyName;
		},
		getRegions: function () {
			return regions.find({owner: this._get()._id});
		},
		getAttackableRegions: function () {
			var id = this._get()._id;
			var ownedRegions = this.getRegions().fetch();
			return _.uniq(_.reduce(ownedRegions, function (result, r) {
				return result.concat(_.pluck(_.filter(Map.getAdjacentRegions(r.x, r.y), function (r) {
					return r.owner !== id;
				}), '_id'));
			}, [], this));
		},
		getId: function () {
			return this._get()._id;
		},
		setAttack: function (regionId) {
			if (Round.number() && !Round.started() && Players(Player.getId()).status() === Players().STATUS.DECLARE) {
				Session.set('attackRegionId', regionId);
				Meteor.call('setAttack', regionId, this._get()._id, regions.findOne({_id: regionId}).owner, Round.number());
			}
		},
		getAttack: function () {
			var battle = battles.findOne({round: Round.number(), attacker: this._get()._id});
			var dummy = Session.get('attackRegionId');
			return battle && battle.region;
			//return Session.get('attackRegionId') || this._get().attack;
		},
		getColor: function () {
			return this._get().color || '#ffffff';
		},
		setColor: function (color) {
			this._update({color: color});
		},
		setIcon: function (data) {
			var id = this._get().icon;
			if (id) {
				images.remove({_id: id});
			}
			id = images.insert({data: data});
			this._update({icon: id});
		},
		getIcon: function () {
			var id = this._get().icon;
			if (id) {
				var image = images.findOne({_id: id});
				return image && image.data;
			}
		}
	};
};
