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

Accounts.ui.config({
	passwordSignupFields: "USERNAME_ONLY"
});

Template.menu.helpers({
	menuItems: function () {
		return [
			{name: 'home', title: 'Home'}
		].concat(Meteor.userId() ? [
			{name: 'armies', title: 'Armies'},
			{name: 'game', title: 'Game'},
			{name: 'chat', title: 'Chat'}						
		] : []);
	},
	selected: function () {
		return this.name === Session.get('currentPage') ? '_selected' : '';
	}
});

Template.warning.helpers({
	show: function () {
		return !Cookie.get('warningSeen');
	}
});

Template.warning.events({
	'click #closeWarning': function () {
		Cookie.set('warningSeen', true);
	}
});
