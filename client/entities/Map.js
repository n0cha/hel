var regionsPerPlayer = 7;

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
		var middleRow = Math.floor(rows / 2);
		_(_.range(0, rows)).each(function (y) {
			var rowLength = cols - Math.abs(y + 1 - radius);
			var xOffset = Math.max(0, middleRow - y);
			_(_.range(xOffset, xOffset + rowLength)).each(function (x) {
				this.insert(x, y);
			}, this);
		}, this);
		
		return this;
	},
	insert: function (x, y) {
		regions.insert({x: x, y: y, owner: ''});
	},
	getWidth: function () {
		//return regions.findOne({}, {sort: {x: -1}}).x + 1;
		return _.max(_.map(regions.find().fetch(), function (region) {
			return region.x + (region.y / 2);
		})) + 1;
	},
	getHeight: function () {
		return regions.findOne({}, {sort: {y: -1}}).y + 1;
	},
	getXMin: function () {
		//return regions.findOne({}, {sort: {x: 1}}).x;
		return _.min(_.map(regions.find().fetch(), function (region) {
			return region.x + (region.y / 2);
		}));
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
					var index = Math.floor(Math.random() * candidates.length);
					var region = candidates[index];
					regions.update(region._id, {$set: {owner: id}});
					if (i === regionsPerPlayer - 1) {
						players.update({_id: id}, {$set: {capital: region._id}});
					}
				}, this);
				playerIndex++;
			}.bind(this));
			this.removeUnownedRegions(this.placePortals.bind(this));
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
		return _.filter(this.getAdjacentRegions(x, y), function (r) {
			return r.owner === owner;
		});
	},
	getAdjacentRegions: function (x, y) {
		var directions = [
					[1, 0],
					[1, -1],
					[0, -1],
					[-1, 0],
					[-1, 1],
					[0, 1]
				];
		
		return _.compact(_.map(directions, function (direction) {
			return this.getRegion(x + direction[0], y + direction[1]);
		}, this));
	},
	getUnownedRegions: function () {
		return regions.find({owner: ''}).fetch();
	},
	removeUnownedRegions: function (callback) {
		Meteor.call('removeUnownedRegions', callback);
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
	},
	placePortals: function () {
		var nrOfPortals = players.find().count();
		var eligibleRegions = regions.find().fetch();
		var minPortalDistance = Math.ceil(regionsPerPlayer / 2);
		
		eligibleRegions = _.filter(eligibleRegions, function (region) {
			return !players.findOne({capital: region._id});
		});
		
		while (nrOfPortals && eligibleRegions.length) {
			eligibleRegions = _.filter(eligibleRegions, function (region) {
				return !_.find(portals.find().fetch(), function (portal) {
					return this.distance(portal, region) < minPortalDistance;
				}, this);
			}, this);
			
			if (eligibleRegions.length) {
				var index = Math.floor(Math.random() * eligibleRegions.length);
				var region = eligibleRegions[index];
				portals.insert({x: region.x, y: region.y});
				eligibleRegions.splice(index, 1);
				nrOfPortals--;
			}
		}
	},
	distance: function (start, dest) {
		return (Math.abs(start.x - dest.x)
				+ Math.abs(start.x + start.y - dest.x - dest.y)
				+ Math.abs(start.y - dest.y)) / 2;
	},
	getPortals: function () {
		return portals.find().fetch();
	},
	getRegions: function () {
		return regions.find().fetch();
	},
	getPortalRegions: function () {
		var portals = this.getPortals();
		return _.filter(this.getRegions(), function (region) {
			return _.findWhere(portals, {x: region.x, y: region.y});
		});
	}
};
