_ = lodash;

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

var nrOfBanners = 7;

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

Template.layout.rendered = function () {
	var menuTop = $('#menu').offset().top;
	$(window).on('scroll', function () {
		if ($(window).scrollTop() > menuTop) {
			$(document.body).addClass('sticky');
		} else {
			$(document.body).removeClass('sticky');
		}
	});

	$('.banner').each(function () {
		var nr = this.id.substr(6);
		$(this).css({backgroundImage: 'url(images/hel-banner-' + nr + '.png)'});
	});
	
	var banner = Math.floor(Math.random() * nrOfBanners) + 1;
	var setBanner = function () {
		var $banner = $('#banner' + banner);
		
		$('.banner').not($banner)
				.addClass('hidden')
		;
		
		$banner
				.addClass('animate')
				.toggleClass('right')
				.removeClass('hidden')
		;

		var newBanner = banner;
		while (newBanner === banner) {
			newBanner = Math.floor(Math.random() * nrOfBanners) + 1;
		}
		banner = newBanner;

		//banner = banner === nrOfBanners ? 1 : banner + 1;
	};
	setBanner();
	setInterval(setBanner, 29000);
};

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
