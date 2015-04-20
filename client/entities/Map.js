var regionsPerPlayer = 10;

Map = {
	getArea: function (radius) {
		return _(_.range(1, radius)).reduce(function (m, v) {return m + v;}, 0) * 6 + 1;
	},
	clear: function () {
		Meteor.call('clearMap');
		Meteor.call('clearBattles');
	},
	create: function (regions) {
		this.clear();

		var playerCount = players.find().count();
		var targetArea = regions || playerCount * regionsPerPlayer;
		var radius = 1;
		while (this.getArea(radius) < targetArea) {
			radius++;
		}
		var cols, rows = cols = radius * 2 - 1;
		_(_.range(0, rows)).each(function (y) {
			var rowLength = cols - Math.abs(y + 1 - radius);
			var xOffset = Math.floor((cols - rowLength) / 2) + (y % 2 ? Math.round(cols / 2) % 2 : 0);
			_(_.range(xOffset, xOffset + rowLength)).each(function (x) {
				this.insert(x, y);
			}, this);
		}, this);
		
		return this;
	},
	insert: function (x, y) {
		regions.insert({x: x, y: y, owner: ''});
	},
	getDiameter: function () {
		return regions.findOne({}, {sort: {x: -1}}).x + 1;
	},
	getWidth: function () {
		return _.map(regions.find().fetch(), function (r) {
			return (1 - r.y % 2) / 2 + r.x + 1;
		}).sort().pop();
	},
	getHeight: function () {
		return regions.findOne({}, {sort: {y: -1}}).y + 1;
	},
	getXMin: function () {
		return _.map(regions.find().fetch(), function (r) {
			return (1 - r.y % 2) / 2 + r.x;
		}).sort().reverse().pop();
	},
	depopulate: function (callback) {
		Meteor.call('depopulateMap', [], callback);
	},
	populate: function () {
		this.depopulate(function () {
			//var regionsPerPlayer = Math.floor(regions.find().count() / players.find().count());
			var playerIndex = 0;
			players.find().forEach(function (player) {
				var id = player._id;
				id = id._str || id;
				_(_.range(0, regionsPerPlayer)).each(function (i) {
					var candidates = this.getUnownedRegions();
					if (i) {
						//candidates = _.filter(candidates, function (r) {
						//	return this.regionAdjacentTo(r.x, r.y, id);
						//}, this);
						candidates = _.filter(candidates, function (r) {
							return this.getAdjacentOwnedRegions(r.x, r.y, id).length >= (i > 3 ? Math.min(i, 2) : 1);
						}, this);
					} else if (playerIndex) {
						candidates = _.filter(candidates, function (r) {
							return this.getAdjacentPlayers(r.x, r.y).length >= Math.min(playerIndex, 2);
						}, this);
					}
					if (!candidates.length) {
						_.defer(this.populate.bind(this));
						throw new Error('No eligible regions :(');
					}
					var index = Math.round(Math.random() * (candidates.length - 1));
					var region = candidates[index];
					regions.update(region._id, {$set: {owner: id}});
					if (!i) {
						players.update({_id: id}, {$set: {capital: region._id}});
					}
				}, this);
				playerIndex++;
			}.bind(this));
			this.removeUnownedRegions();
			this.nameRegions();
		}.bind(this))
	},
	getRegionOwner: function (x, y) {
		return regions.findOne({x: x, y: y}).owner;
	},
	getRegion: function (x, y) {
		return regions.findOne({x: x, y: y});
	},
	regionAdjacentTo: function (x, y, owner) {
		var regions = this.getAdjacentRegions(x, y);
		return !!_.find(regions, function (r) {
			return r.owner === owner;
		});
	},
	getAdjacentOwnedRegions: function (x, y, owner) {
		var regions = this.getAdjacentRegions(x, y);
		return _.filter(regions, function (r) {
			return r.owner === owner;
		});
	},
	getAdjacentRegions: function (x, y) {
		var regions = [];
		var offset = (y % 2) * -1;
		regions.push([x - 1, y]);
		regions.push([x + 1, y]);

		regions.push([x + offset, y - 1]);
		regions.push([x + offset + 1, y - 1]);

		regions.push([x + offset, y + 1]);
		regions.push([x + offset + 1, y + 1]);

		return _.compact(_.map(regions, function (r) {
			return this.getRegion(r[0], r[1]);
		}, this));
	},
	getUnownedRegions: function () {
		return regions.find({owner: ''}).fetch();
	},
	removeUnownedRegions: function () {
		Meteor.call('removeUnownedRegions');
	},
	getAdjacentPlayers: function (x, y) {
		return _.compact(_.uniq(_.pluck(this.getAdjacentRegions(x, y), 'owner')));
	},
	nameRegions: function () {
		Meteor.call('getRegionNames', [regions.find().count()], function (err, names) {
			regions.find().forEach(function (region) {
				regions.update(region._id, {$set: {name: names.pop()}});
			});
		});
	}
};
