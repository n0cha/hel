Router.configure({
	layoutTemplate: 'layout'
});
Router.route('/:page', function () {
	Session.set('currentPage', this.params.page);
	this.render(this.params.page);
});
Router.route('(.*)', function () {
	Session.set('currentPage', 'home');
	this.render('home');
});

var armies = new Meteor.Collection('armies');
var regions = new Meteor.Collection('regions');
var rounds = new Meteor.Collection('rounds');
var players = new Meteor.Collection('players');
var armyLists = new Meteor.Collection('armyLists');
var battles = new Meteor.Collection('battles');
var images = new Meteor.Collection('images');

var Player = {
	_player: undefined,
	
	_get: function () {
		return players.findOne({userId: Meteor.userId()}) || {};
		//if (!this._player) {
		//	if (!players.find().count()) {
		//		return {};
		//	}
		//	this._player = players.findOne({userId: Meteor.userId()});
		//}
		//return this._player || {};
	},
	create: function () {
		this.player = {userId: Meteor.userId(), army: 0};
		this.player._id = players.insert({userId: Meteor.userId(), army: 0});
	},
	getArmy: function () {
		return this._get().army;
	},
	setArmy: function (army) {
		this._update({army: army});
	},
	_update: function (fields) {
		players.update(this._get()._id, {$set: fields});
		this._player = undefined;
	},
	getArmyList: function (round) {
		return armyLists.findOne({player: this._get()._id, round: round || Round.number()}) || '';
	},
	setArmyList: function (data) {
		var id = this.getArmyList()._id;
		if (id) {
			armyLists.update(id, {list: data});
		} else {
			armyLists.insert({player: this._get()._id, round: Round.number(), list: data});
		}
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
		Session.set('attackRegionId', regionId);
		Meteor.call('setAttack', regionId, this._get()._id, regions.findOne({_id: regionId}).owner);
		this._update({attack: regionId});
	},
	getAttack: function () {
		return Session.get('attackRegionId') || this._get().attack;
	},
	getColor: function () {
		return this._get().color || 'white';
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

var Round = {
	_round: undefined,
	pointIncrement: 500,
	
	_get: function () {
		if (!this._round) {
			this._round = rounds.findOne({}, {sort: {number: -1}}) || {
				number: 1,
				started: false
			};
		}
		return this._round;
	},
	number: function () {
		return this._get().number;
	},
	started: function () {
		return this._get().started;
	},
	points: function () {
		return this._get().number * this.pointIncrement;
	}
};

var Map = {
	getArea: function (radius) {
		return _(_.range(1, radius)).reduce(function (m, v) {return m + v;}, 0) * 6 + 1;
	},
	clear: function () {
		Meteor.call('clearMap');
		Meteor.call('clearBattles');
	},
	create: function () {
		this.clear();
		
		var playerCount = players.find().count();
		var targetArea = playerCount * 5;
		var radius = 1;
		while (this.getArea(radius) < targetArea) {
			radius++;
		}
		var cols, rows = cols = radius * 2 - 1;
		_(_.range(0, rows)).each(function (y) {
			var rowLength = cols - Math.abs(y + 1 - radius);
			var xOffset = Math.floor((cols - rowLength) / 2);
			_(_.range(xOffset, xOffset + rowLength)).each(function (x) {
				this.insert(x, y);
			}, this);
		}, this);
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
			var regionsPerPlayer = 5;
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

Template.menu.helpers({
	menuItems: function () {
		return [
			{name: 'home', title: 'Home'},
			{name: 'armies', title: 'Armies'},
			{name: 'game', title: 'Game'}
		];
	},
	selected: function () {
		return this.name === Session.get('currentPage') ? '_selected' : '';
	}
});

Template.round.helpers({
	number: function () {
		return Round.number();
	},
	started: function () {
		return Round.started();
	},
	points: function () {
		return Round.points();
	}
});

Template.round.events({
	'click #createMap': function () {
		Map.create();
	},
	'click #populateMap': function () {
		Map.populate();
	},
	'click #createPlayer': function () {
		Player.create();
	}
});

Template.armies.helpers({
	gameStarted: function () {
		return Round.number() > 1 || Round.started();
	},
	army: function () {
		return Player.getArmy();
	},
	armies: function () {
		return armies.find();
	},
	selected: function () {
		return this.name === Player.getArmy() ? 'selected' : '';
	},
	roundPrep: function () {
		return !Round.started();
	},
	armyList: function () {
		return Player.getArmyList().list;
	},
	armyName: function () {
		return Player.getArmyName();
	},
	roundPoints: function () {
		return Round.points();
	},
	color: function () {
		//Meteor.defer(function () {
		//	$('#colorPicker').colorpicker().on('changeColor.colorpicker', function(event){
		//		Player.setColor(event.color.toHex());
		//	});
		//});
		return Player.getColor();
	},
	icon: function () {
		return Player.getIcon();
	},
	player: function () {
		return Player.getId();
	}
});

Template.armies.rendered = function () {
};

var prevent = function (e) {
	e.stopPropagation();
	e.preventDefault();
};

Template.armies.events({
	'change #army': function (event) {
		Player.setArmy(event.target.value);
	},
	'change #armyName': function (event) {
		Player.setArmyName(event.target.value);
	},
	'click #submitArmyList': function (event) {
		Player.setArmyList($('#armyList').val());
	},
	'change #colorPicker': function (event) {
		Player.setColor(event.target.value);
	},
	'dragenter #dropzone': prevent,
	'dragexit #dropzone': prevent,
	'dragover #dropzone': prevent,
	'drop #dropzone': function (e) {
		prevent(e);
		if (e.dataTransfer.files.length) {
			var file = e.dataTransfer.files[0],
					reader = new FileReader();

			reader.onload = function () {
				var data = reader.result,
						parsedData = /^data:([^;]*);base64,(.*)$/.exec(data),
						mimeType = parsedData[1]
				;

				if (mimeType.match(/^image\/\w+$/)) {
					Player.setIcon(data);
					//$('<img />')
					//		.attr('src', data)
					//		.on('load', function () {
					//			Meteor.defer(function () {
					//				Player.setIcon(data);
					//			}.bind(this));
					//		})
					//;
				}
			};

			reader.readAsDataURL(file);
		} else {
			var data = e.dataTransfer.getData('text/html');
			if (data) {
				var canvas = $('<canvas>'),
						image = $(data).get(1);
				image.onload = function () {
					canvas.attr('width', image.width);
					canvas.attr('height', image.height);
					canvas.get(0).getContext('2d').drawImage(image, 0, 0);
					Player.setIcon(canvas.get(0).toDataURL());
				};
			}
		}
	}
});

Template.game.events({
	'click #nextRound': function () {
		rounds.insert({});
	}
});

var hexWidth = 60;
var hexHeight = 45;

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
		return player && player.color || '#fff';
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
		return this.owner === Player.getId() ? 1 : 0;
	},
	attacking: function () {
		return Player.getAttack() === this._id ? 1 : 0;
	},
	attackable: function () {
		return _.contains(Player.getAttackableRegions(), this._id);
	},
	capital: function () {
		var player = players.findOne({capital: this._id});
		if (player) {
			var icon = images.findOne({_id: player.icon});
		}
		return player && icon && icon.data;
	}
});

Template.map.rendered = function () {
	_.each(Player.getAttackableRegions(), function (id) {
		//$('#map polygon[data-id="' + id + '"').hover(function () {
		//	$(this).addClass('_hover');
		//}, function () {
		//	$(this).removeClass('_hover', 0.5);
		//});
		$('#map .region[data-id="' + id + '"')
				.attr('data-attackable', 1)
				.click(function () {
					Player.setAttack(id);
					//$('#map .region').removeAttr('data-attacking');
					//$(this).attr('data-attacking', 1);
				})
		;
	});
};

Template.battles.helpers({
	battles: function () {
		//var _battles = battles.aggregate([{$group: {_id: '$region', defender: {$first: '$defender'}, attackers: {$addToSet: '$attacker'}}}]).fetch();
		var _battles = {};
		var getPlayer = function (id, role) {
			return _.extend(players.findOne({_id: id}), {role: role});
		};
		var i = 0;
					
		battles.find().forEach(function (b) {
			if (!_battles[b.region]) {
				_battles[b.region] = {
					number: ++i,
					region: (regions.findOne({_id: b.region}) || {}).name,
					players: [getPlayer(b.defender, 'defender')]
				};
			}
			_battles[b.region].players.unshift(getPlayer(b.attacker, 'attacker'));
		});
		
		return _.toArray(_battles);
	}
});

Accounts.ui.config({
	passwordSignupFields: "USERNAME_ONLY"
});
