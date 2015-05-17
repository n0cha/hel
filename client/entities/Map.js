var regionsPerPlayer = 7;

Map = {
	getArea: function (radius) {
		return _(_.range(1, radius)).reduce(function (m, v) {return m + v;}, 0) * 6 + 1;
	},
	clear: function () {
		Meteor.call('clearMap');
	},
	create: function () {
		this.clear();

		var playerCount = players.find().count();
		var targetArea = playerCount * regionsPerPlayer * 3;
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
	},
	insert: function (x, y) {
		regions.insert({x: x, y: y, owner: ''});
	},
	getWidth: function () {
		return _.max(_.map(regions.find().fetch(), function (region) {
			return region.x + (region.y / 2);
		})) + 1;
	},
	getHeight: function () {
		return regions.findOne({}, {sort: {y: -1}}).y + 1;
	},
	getXMin: function () {
		return _.min(_.map(regions.find().fetch(), function (region) {
			return region.x + (region.y / 2);
		}));
	},
	getYMin: function () {
		return regions.findOne({}, {sort: {y: 1}}).y;
	},
	depopulate: function (callback) {
		Meteor.call('depopulateMap', [], callback);
	},
	populate: function () {
		this.depopulate(function () {
			var playerIndex = 0;
			players.find().forEach(function (player) {
				var id = player._id;
				id = id._str || id;
				_(_.range(0, regionsPerPlayer)).each(function (regionIndex) {
					var candidates;
					console.log('[player]', playerIndex, '[region]', regionIndex);
					if (regionIndex) {
						// second and other regions
						// need to border on at least 1 region owned by self
						// need to border on at least 2 regions owned by any player
						// except player 0 region 1 (first player, second region), because then there aren't enough regions yet
						candidates = Player(id).adjacentRegions().filter(function (r) {
							return !r.owner && this.getAdjacentOwnedRegions(r.x, r.y).value().length >= (!playerIndex && regionIndex === 1 ? 1 : 2);
						}, this);
					} else {
						// first region
						if (playerIndex) {
							// second and other players
							// needs to border on at least 2 players
							candidates = this.getUnownedRegions();
							candidates = _.filter(candidates, function (r) {
								return this.getAdjacentPlayers(r.x, r.y).value().length >= Math.min(playerIndex, 2);
							}, this);
						} else {
							// first player
							// center of map
							var center = (this.getHeight() - 1) / 2;
							candidates = [this.getRegion(center, center)];
						}
					}
					console.log('found', candidates.length, 'candidates');
					if (!candidates.length) {
						_.defer(this.populate.bind(this));
						throw new Error('No eligible regions :(');
					}
					var region = _.sample(candidates);
					regions.update(region._id, {$set: {owner: id}});
					if (regionIndex === regionsPerPlayer - 1) {
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
		var regions = this.getAdjacentRegions(x, y).value();
		return !!_.find(regions, function (r) {
			return r.owner === owner;
		});
	},
	getAdjacentOwnedRegions: function (x, y, owner) {
		return this.getAdjacentRegions(x, y).filter(function (r) {
			if (owner) {
				return r.owner === owner;
			} else {
				return !!r.owner;
			}
		});
	},
	getAdjacentUnownedRegions: function (x, y) {
		return this.getAdjacentRegions(x, y).filter(function (r) {
			return !r.owner;
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
		
		return _(directions).map(function (direction) {
			return this.getRegion(x + direction[0], y + direction[1]);
		}, this).compact();
	},
	getUnownedRegions: function () {
		return regions.find({owner: ''}).fetch();
	},
	removeUnownedRegions: function (callback) {
		Meteor.call('removeUnownedRegions', callback);
	},
	getAdjacentPlayers: function (x, y) {
		return this.getAdjacentRegions(x, y).pluck('owner').uniq().compact();
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
