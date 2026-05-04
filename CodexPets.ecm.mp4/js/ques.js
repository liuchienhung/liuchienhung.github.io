fs.ques = (function(){

	var quiz, player, lang, param;
	var quizEnable = true;
	var currId, bypass = new Array();

	var sortedQuiz	= new Array(),
		storage		= new Array();

	var pass = false;

	var lock = new Array();

	var quizMask;


	return {

		getItem: function(k)	{ return fs.storage.getItem('quiz-' + k);	},
		setItem: function(k, v)	{ fs.storage.setItem('quiz-' + k, v);		},

		setAnsweredQId: function(id) {
			var jsonString = '';
			param.answeredQId[id] = id;
			jsonString = JSON.stringify(param.answeredQId);

			fs.cookie.setItem('quizAnswerd-'+param.sessionID, jsonString);
		},

		removeRecord: function(){
			$.each(sortedQuiz, function( k, v ) { fs.storage.removeItem('quiz-' + parseInt(v.mapId, 10)); });
		},

		init : function( p, q, l, prm ){

			quiz = q; player = $('#' + p); lang = l; param=prm;

			if ( quiz.length == 0 ) return;

			var type = fs.video.type();
			if ( type != 'html5' && type != 'embed' ) {

				if ( !fs.video.isSupport('html5') ) {
					alert( lang.quizNoSupFlashPS );
					fs.video.forcePlayerType( 'html5', lang.quizNeedHTML5PlayerPS );

					return;
				}

				fs.video.changePlayer('html5');

				return;
			}

			fs.video.forcePlayerType( 'html5', lang.quizNeedHTML5PlayerPS );

			/* append quizMask in player */
			quizMask = $('<div>', {'role' : 'quizMask', 'class' : 'quiz-mask', 'style': 'display:none'}).appendTo( player );

			this.sortQuiz();
			this.bindEvent();

			var cuePoint = new Array();

			var self = this;

			$.each(quiz, function( k, v ){
				cuePoint.push( {evt: 'video-quiz', time: parseInt(v.time, 10)/1000, args: { id : k }} );
			});

			this.showCuePoints();

			fs.video.setBeforeSeek( $.proxy(this.checkQuiz, this) );
			fs.video.setCuePoint( cuePoint );
		},

		disableQuiz: function() {
			quizEnable = false;
		},

		enableQuiz: function() {
			quizEnable = true;
		},

		showCuePoints : function() {

			/* show cue points only on jqplayer (html5) */
			if ( fs.video.type() !== 'html5' ) return;

			var self = this,
				progressWrapper = player.find('.fs-progress-wrapper'),
				videoDuration = fs.video.getDuration() * 1000, // micro seconds
				currentIndex = fs.video.getCurrIndex(),
				indexMode = false;

			function plotCuePoints() {

				/* clear all cue points */
				progressWrapper.find('.cue-point').remove();

				/* create cue points */
				$.each(quiz, function( k, v ){

					var quizTime = parseInt(v.time, 10),
						percent;

					if ( indexMode ) { // index mode, plot cue points in the index
						if ( !( currentIndex.time <= quizTime && quizTime < ( currentIndex.time + currentIndex.duration ) ) ) return;
						percent = ( quizTime - currentIndex.time ) / currentIndex.duration * 100;
					} else { // not index mode, plot all cue points
						percent = quizTime / videoDuration * 100;
					}

					/* show cue points on progressbar */
					progressWrapper.append( $("<div>", {
						class: 'cue-point', 
						style: 'left:' + percent + '%'
					}));
				});
			};

			/* plot when init */
			plotCuePoints();

			/* plot when index changed */
			fs.event.register('player.indexChange', function(newIndex){
				currentIndex = fs.video.getCurrIndex();
				plotCuePoints();
			});

			/* plot when index mode changed */
			fs.event.register('player.indexModeChanged', function(value){
				indexMode = value;
				plotCuePoints();
			});
		},

		quizStatusCheck : function(){

			if ( $('[role="quiz"]').length > 0 ) return false;

			var exam = this.getQuiz( fs.video.getPos() );

			if ( exam ) {
				fs.video.pause();
				fs.video.setPos( parseInt(exam.time, 10) / 1000 );
				this.setupQuestion( exam );
			}

			return true;
		},


		sortQuiz : function(){

			var qt = new Array();
			for (var key in quiz) qt.push( quiz[key] );

			qt.sort(function(a, b) {return a.time - b.time});

			$.each(qt, function( k, v ) { sortedQuiz.push(v); });
		},

		bindEvent: function(){

			var self = this;

			fs.event.register('player.timeUpdate', function(){

				if ( $('[role="quiz"]').length > 0 ) fs.video.pause();

				var time = fs.video.getPos(),
                    pb   = fs.video.getPlaybackrate();
				$.each(quiz, function( k, v ){
					if ( Math.abs( time - (parseInt(v.time, 10) / 1000)) <= .25 * pb) return;
					lock[v.mapId] = false;
				});
			});

			fs.event.register('video-quiz', function(obj){
				if (!quizEnable) return;
				if ( $('[role="quiz"]').length > 0 ) return;

				var mapId = obj.id;
				var exam = quiz[ mapId ];

				if ( lock[mapId] ) return;

				if ( exam ) {
					fs.video.pause();
					self.setupQuestion( exam );
				}
			});

			fs.event.register('quiz.submit', function(qid){
				self.setAnsweredQId(qid);
			})
		},

		checkQuiz : function( time ) {

			var ct = fs.video.getPos();

			if ( Math.abs(time-ct) < .5 ) return {status: false};

			if ( $('[role="quiz"]').length > 0 && time < ct ) {
				this.hideQuiz();
				return {status: true};
			}

			bypass = new Array();
			$.each(sortedQuiz, function( k, v ) {

				/* skip if quiz time is later than 'time' */
				if ( (parseInt(v.time, 10) / 1000) >= time ) return;

				var config	= JSON.parse( v.config ),
					mapId	= parseInt(v.mapId, 10);

				if ( config.bypass != 'true' ) return;

				bypass.push(mapId);
			});

			var q = this.getQuiz( time );

			if ( !q ) return {status:true};
			if (!quizEnable) return {status:true};

			var self = this;

			fs.event.registerOne('player.seekFinished', function(){
				if (!quizEnable) return;
				if ( $('[role="quiz"]').length > 0 ) return;

				if ( q ) {
					if ( lock[q.mapId] ) return;
					fs.video.pause();
					self.setupQuestion( q );
				}
			});

			return  {status:false, pause:true, pos: parseInt(q.time, 10)/1000};
		},

		getQuiz : function( ct ){
			var q		= null,
				self	= this;

			$.each(sortedQuiz, function( k, v ) {

				var t = (parseInt(v.time, 10) / 1000);

				if ( t > ct ) return;

				var config	= JSON.parse( v.config ),
					mapId	= parseInt(v.mapId, 10);

				if ( config.bypass == 'true' && $.inArray(mapId, bypass) != -1 ) return;
				if ( self.getItem( mapId ) != 'true' ) {
					q = v;
					return false;
				}
			});

			return q;
		},

		setupQuestion : function( exam ){
			if (!quizEnable) return;
			currId	= exam.mapId;

			lock[ currId ] = true;

			var self = this,
				id		= 'quiz-' + currId,
				ques	= fs.ques[ exam.type ],
				question = $('<div>', {
					'id'	: id,
					'role'	: 'quiz',
					'class'	: 'quiz ' + exam.type,
					'html'	: ques.init( id, exam, lang, this.getItem(currId), param )
				});

			/* show quiz mask */
			quizMask.fadeIn('fast');

			if ( exam.cust_pos == 1 ) { /* custom position */

				if ( player.width() >= 768 ) { /* wide player, show question */

					var wideMarker = $('<div class="position-marker wide-marker"><div class="triangle"></div></div>')
						.appendTo( player )
						.hide()
						.css({
							'left': exam.posX * 100 + '%',
							'top': exam.posY * 100 + '%'
						})
						.attr('direction', exam.direction)
						.fadeIn('fast');

					/* calculate question position  */
					var left = exam.posX * 100 + '%',
						top = exam.posY * 100 + '%', 
						right = ( 1 - exam.posX ) * 100 + '%',
						bottom = ( 1 - exam.posY ) * 100 + '%',
						maxHeight = '';

					switch ( exam.direction ) {
						case '0': // 左上
							maxHeight = top;
							left = '5px'; /* space between video edge and quiz */
							top = '';
							break;

						// case '1': // 上
							// break;

						case '2': // 右上
							maxHeight = top;
							right = '5px'; /* space between video edge and quiz */
							top = '';
							break;

						// case '3': // 右
							// break;

						case '4': // 右下
							maxHeight = bottom;
							right = '5px'; /* space between video edge and quiz */
							bottom = '';
							break;

						// case '5': // 下
							// break;

						case '6': // 左下
							maxHeight = bottom;
							left = '5px'; /* space between video edge and quiz */
							bottom = '';
							break;

						// case '7': // 左
							// break;

						default:
							break;
					}

					/* set question position */
					question.css({
						'left': left,
						'right': right,
						'top': top,
						'bottom': bottom,
						'max-height': maxHeight
					}).addClass('cust-position').hide().insertAfter( wideMarker );

					/* show question */
					question.fadeIn('fast');

				} else { /* narrow player, show quiz bubble */

					var narrowMarker = $('<div class="position-marker narrow-marker"><div class="bubble">!</div><div class="triangle"></div></div>')
						.appendTo( player )
						.hide()
						.css({
							'left': exam.posX * 100 + '%',
							'top': exam.posY * 100 + '%'
						})
						.attr('direction', exam.direction)
						.fadeIn('fast')
						.click( function(){ 
							/* maxmize question when click narrow marker */
							self.maximize( id );
						} );

					/* use default position, minimize question */
					question.addClass('default-position minimize').appendTo( player );
				}

			} else { /* default position */

				/* show question */
				question.addClass('default-position')
					.hide()
					.appendTo( player )
					.fadeIn('fast');
			}

			ques.setupEvent();
			question.bind('touchmove', function(e){ e.stopPropagation(); });
		},

		minimize : function( id ){
			var question = $('#' + id);

			var max = $('<button>', {
				'class' : 'maxbtn btn btn-default btn-sm',
				'text'	: lang.quizResizer,
				'role'	: 'maximize'
			});

			player.append( max );

			question.addClass('minimize');

			/* hide wide player marker */
			player.find('.wide-marker').hide();

			var self = this;
			max.click( function(){ self.maximize( id ); } );
		},

		maximize : function( id ){
			var question = $('#' + id);

			player.find('[role="maximize"]').remove();

			question.removeClass('minimize');
			
			/* show wide player marker */
			player.find('.wide-marker').show();
		},

		hideQuiz : function(){
			currId = null;

			var question 	= $('[role="quiz"]'),
				self		= this;

			question.fadeOut('fast', function() {
				$(this).remove();
				quizMask.fadeOut('fast');
				$('[role="maximize"]').remove();
			} );

			/* remove wide player marker */
			player.find('.wide-marker').fadeOut('fast', function(){$(this).remove()});
		},

		next : function(){
			var self = this,
				question = $('[role="quiz"]'),
				ct = fs.video.getPos(),	//Current time
				pb = fs.video.getPlaybackrate(),
				exam = null;

			this.setItem( currId, true );
			currId = null;

			question.fadeOut('fast', function() {
				$(this).remove();

				quizMask.fadeOut('fast');

				$.each(sortedQuiz, function( k, v ) {
					var qt = (parseInt(v.time, 10) / 1000),	//Question Time
						mapId	= parseInt(v.mapId, 10);

					if (Math.abs( ct - qt) < .25 * pb && !lock[mapId] ) {
						exam = v;
						return false;
					}
					return;
				});

				if ( exam ) {
                    self.setupQuestion(exam);
                }
				else {
                    fs.video.play();
                }
			});

			/* remove position marker */
			player.find('.position-marker').fadeOut('fast', function(){$(this).remove()});
		}
	}
})();
