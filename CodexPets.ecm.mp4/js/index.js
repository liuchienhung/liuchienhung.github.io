fs.index = (function() {

	var index, duration;
	var indexTmpl = fs.tmpl('<div class="duration">{%= o.duration %}</div>{%= o.idx %}');

	return {

		init: function( selector, lst, dura){

			duration = dura;

			this.selector = $(selector);

			index = lst;

			// var list = $('<ul>'),
			// 	sn1  = 0, sn2 = 0,
			// 	self = this;

			// $.each(index, function(idx, itm){

			// 	// var title = itm.title;

			// 	var li = $('<li>', {
			// 		'class'	: 'idx', 'role'	: 'idx',
			// 		'sn'	: idx,
			// 		'idxID'	: itm.id,
			// 		'title'	: itm.title
			// 	});

			// 	if ( sn1 == 0 && sn2 == 0 )
			// 		li.addClass('curr');

			// 	if (itm.indent == true) {
			// 		li.toggleClass('indent', true);
			// 		sn2++;
			// 	} else {
			// 		sn1++;
			// 		sn2 = 0;
			// 	}

			// 	var sn = (sn2 != 0) ? sn1 + '.' + sn2 : sn1 + '.';

			// 	li.append(
			// 		indexTmpl({
			// 			idx			: sn + ' ' + itm.title,
			// 			duration	: self.formatTime( self.getDuration( idx ) )
			// 		})
			// 	);

			// 	list.append(li);
			// });

			// this.selector.append(list);
			this.bindEvents();
		},

		bindEvents : function(){
			var self = this;

			this.selector.find('[role="idx"]').click(function(){
				fs.video.setSlide( index[ $(this).attr('sn') ] );
			});

			fs.event.register( 'player.indexChange', function( index ){
				self.selector.find('[role="idx"]').toggleClass('curr', false);
				self.selector.find('[role="idx"][idxID="' + index.id + '"]').toggleClass('curr', true);
			});
		},

		getDuration : function( from ){
			// -1 : attach

			if ( index[from].time == -1 ) return '';
            var end = this.getNextTime( from );

			return end - index[from].time + 1000;
		},

		getNextTime	: function( from ){

			for (var i=(from+1); i<index.length; i++) {

				if ( index[i].time == -1 ) continue;

				return index[i].time;
			}

			return duration * 1000;
		},

		formatTime: function( ms ){

			if ( !ms ) return '';

			s = Math.floor(ms / 1000); // to second

			var hours  = ( s >= 3600 )
				? Math.floor(s / 3600)
				: 0;

			var mins   = Math.floor((s - hours*3600) / 60);
			var second = s % 60;

			if (mins   < 10) mins   = '0' + mins;
			if (second < 10) second = '0' + second;

			return ( !hours )
				? mins + ':' + second
				: hours + ':' + mins + ':' + second;
		},


		toMS: function( t ){
			t = t.split(':');

			var s =  ( t.length == 3 )
				? 3600*parseInt(t[0]) + 60*parseInt(t[1]) + parseInt(t[2])
				: 60*parseInt(t[0]) + parseInt(t[1]);

			return s * 1000;
		}

	};
})();
