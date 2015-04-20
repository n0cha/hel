Icon = function (id) {
	var image = images.findOne({_id: id});
	return image && image.data || '';
};

Icon.fromUrl = function (url, trans, callback) {
	var image = new Image();
	image.src = url;

	this.fromImage(image, trans, callback);
};

Icon.fromImage = function (image, trans, callback) {
	imageToCanvas(image, function (canvas) {
		makeTransparent(canvas, trans);
		
		callback(canvas.toDataURL());
	});
};

function makeTransparent(canvas, method) {
	if (method === 'none') {
		return;
	}
	
	var ctx = canvas.getContext('2d');
	var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	var data = imageData.data;
	
	if (method === 'auto') {
		var c = [data[0], data[1], data[2]];
	}
	
	for (var i = 0, len = data.length; i < len; i+=4) {
		var val = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
		switch (method) {
			case 'white':
				data[i + 3] = 255 - Math.max(0, val - 224) * 8;
				break;
			case 'black':
				data[i + 3] = Math.min(255, val * 8);
				break;
			case 'auto':
				if (data[i] === c[0] && data[i + 1] === c[1] && data[i + 2] === c[2]) {
					data[i + 3] = 0;
				}
				break;
		}
	}
	
	ctx.putImageData(imageData, 0, 0);
}

function imageToCanvas(image, callback) {
	image.crossOrigin = 'Anonymous';
	image.onload = function () {
		var canvas = $('<canvas>');
		canvas.attr('width', image.width);
		canvas.attr('height', image.height);
		canvas = canvas.get(0);
		canvas.getContext('2d').drawImage(image, 0, 0);
		callback(canvas);
	}
}
