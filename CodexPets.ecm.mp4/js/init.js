(function(){

    var tmpl = {
        index: '<li class="idx js-index-item {{if curr }} curr {{/if}} {{if indent }} indent {{/if}}" data-id="{{= index.id }}" data-time="{{ = index.time }}" role="idx" idxid="{{= index.id }}" sn="{{= key }}">\
	                <span class="time hint" title="開始於：{{= timeStr }}">{{= durationStr }}</span>\
	                <span class="sn">{{= snStr }}</span>\
	                <div class="title js-title" title="{{= index.title }}">{{= index.title }}</div>\
	            </li>'
    };

    /* render index */
    var sn = 0,
        subSn = 0,
        snStr;

    $.each( config.index, function(k, idx){

        /* indent index */
        if ( idx.indent == 1 ) {
            subSn++; // increase subSn
            snStr = sn + '.' + subSn;
        } else {
            sn++; // increase sn
            subSn = 0; // reset subSn
            snStr = sn + '.';
        }

        /* calculate duration */
        var duration = 0;
        if ( (k + 1) === config.index.length ) {
            // last index
            duration = config.duration * 1000 - config.index[k].time;
        }
        else {
            duration = config.index[k + 1].time - idx.time;
        }

        /* append index items to index lists */
        if (config.hideSN) {
            $('.indexBox > ul').append(
                $.tmpl( tmpl.index, {
                    key: k,
                    index: idx,
                    timeStr: fs.index.formatTime( idx.time ),
                    durationStr: fs.index.formatTime( duration ),
                    curr: ( sn === 1 && subSn === 0 ),
                    indent: ( idx.indent == 1 )
                })
            );
        }
        else {
            $('.indexBox > ul').append(
                $.tmpl( tmpl.index, {
                    key: k,
                    index: idx,
                    timeStr: fs.index.formatTime( idx.time ),
                    durationStr: fs.index.formatTime( duration ),
                    snStr: snStr,
                    curr: ( sn === 1 && subSn === 0 ),
                    indent: ( idx.indent == 1 )
                })
            );
        }
    } );

    /* set title */
    document.title = config.title;
    $('#titlePanel .title').text( config.title );

    /* set title hint */
    var titleText = fs.util.posToTime( config.duration, true );
    if (config.date != "") {
        titleText = titleText + ', ' + config.date;
    }

    if (config.author.name != "") {
        titleText = titleText + ', by ' + config.author.name;
    }
    $('#titlePanel .fs-hint').text(titleText);

    /* set author */
    $('.author-img').attr( 'src', config.author.photo );


    /* init video player */
    fs.video.init( 'fsPlayer', { "autoplay": "no", "embed": false }, config, { "playback": "速度", "normal": "正常", "resolution": "畫質", "fullscreen": "全螢幕", "volume": "音量" } );

    /* init index */
    fs.index.init( '.indexBox', config.index, config.duration );

    /* init video quiz */
    fs.event.register('player.videoReady', function(){
        fs.ques.init( fs.video.getPlayerId(), quizConfig.quiz, quizConfig.lang, quizConfig.param );
    });

    /* init kmvideo (page layout control, responsive) */
    fs.kmvideo.init();

})();
