;(function(window, undefined){
	var Mix, Track, debounce, on, off, trigger, solo, unsolo, log10, body;
	console.log("LOADED MIX")
	//~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Just a reference to the body element
	body = document.getElementsByTagName('body')[0];


	debounce = function(func, wait) {
	    var timeout;
	    return function() {
	        var context = this, args = arguments,
	        later = function() {
	            timeout = null;
	            func.apply(context, args);
	        };
	        clearTimeout(timeout);
	        timeout = setTimeout(later, wait);
	    };
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Utility function for binding events
	on = function( type, callback ){
		this.events[type] = this.events[type] || [];
		this.events[type].push( callback );
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Utility function for removing all events of a given type
	off = function( type ){
		this.events[type] = [];
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Utility function for trigger events
	trigger = function( type ){
		//console.log(type)
		if ( !this.events[type] ) return;
		var args = Array.prototype.slice.call(arguments, 1);
		for (var i = 0, l = this.events[type].length; i < l;  i++)
			if ( typeof this.events[type][i] == 'function' ) 
				this.events[type][i].apply(this, args);
	};

	soloMute = function(){
		var total = this.tracks.length,
			soloed = this.soloed;

			console.log(soloed)
		for ( var i = 0; i < total; i++ ){
			var self = this.tracks[i];
			// Perform new mutes
			if ( self.get('muted') && !self.get('_muted') ) {

				self.set('gainCache', self.gain());
				self.set('_muted', true);
				self.gain(0.1, true);
			}
			if ( soloed > 0 ){
				if ( self.get('soloed') ){
					self.gain(self.get('gainCache'), true);
					self.set('_muted', false);
				} else if ( !self.get('_muted') ) {
					self.set('gainCache', self.gain());
					self.gain(0.1, true);
					self.set('_muted', true);
				}
			} else {
				// Unmute
				if ( !self.get('muted') ){
					self.set('_muted', false);
					self.gain(self.get('gainCache'), true);
				}
			}
		}
	};
		
	
	Mix = function(opts){

	  	this.tracks = [];
	  	this.gain =  1;
	  	this.events = {};
	  	this.lookup = {};
	  	this.soloed = 0;
		this.ready = false;
		this.playing = false;
		this.progress = 0;
		this.averagevolume = 0;
		this.volumeleft = 0;
		this.volumeright = 0;
		this.gain = 1;
		this._meterCount = 0;
		this.loaded = 0;
		this.startLoad = 0

		this.on('soloMute', function(){
			soloMute.apply(this, arguments)
		});

		if ( typeof AudioContext === 'function' ) 
			this.context = new AudioContext();
		else 
			this.context = new webkitAudioContext();
		
							
	}
	
	Mix.prototype.initMix = function(startTime){
		
	  	this.startTime = startTime;
		var defaults = {};	

		this.on('load', function(){
			var total = this.tracks.length;
			this.loaded += 1;
			if ( total == this.loaded ){
				this.ready = true;
				this.trigger('ready');
			}
		});
				
	}
	
	Mix.prototype.createTrack = function(name, opts){
		
		if ( !name || this.lookup[name] ) return;
		var track = new Track(name, opts, this);
		
		this.tracks.push( track );
		this.lookup[name] = track;
		return track;
		
	};

	Mix.prototype.getTrack = function(name){
		return this.lookup[name];
	};

	Mix.prototype.createTrackZero = function(name, opts){
		//if ( !name || this.lookup[name] ) return;
		var track = new Track(name, opts, this);
		
		this.tracks[0] =  track;
		this.lookup[name] = track;
		return track;
		
	};	
	
		Mix.prototype.pause = function(){
		var total = this.tracks.length;
		this.playing = false;
		for ( var i = 0; i < total; i++ )
			if ( this.tracks[i].ready ) this.tracks[i].pause();
	};
	
	Mix.prototype.extend = function(){
		var output = {}, args = arguments, l = args.length;
		for ( var i = 0; i < l; i++ )		
			for ( var key in args[i] )
				if ( args[i].hasOwnProperty(key) )
					output[key] = args[i][key];
		return output;
	};

	Mix.prototype.removeTrack = function(name){
		console.log("removing " + name)
		var rest, arr = this.tracks, total = arr.length;
		for ( var i = 0; i < total; i++ ){
			if ( arr[i] && arr[i].name == name ){
				rest = arr.slice(i + 1 || total);
				arr.length = i < 0 ? total + i : i;
				arr.push.apply( arr, rest );
			}
		}
		delete this.lookup[name];
	};	

	Mix.prototype.on = function(){
		on.apply(this, arguments);
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Unind all events of a given type from a Track instance
	Mix.prototype.off = function(){
		off.apply(this, arguments);
	};
		
	Mix.prototype.trigger = function(){
		trigger.apply(this, arguments);
	}

	// Set Master gain
	Mix.prototype.setGain = function( gain ){
		var total = this.tracks.length;
		this.gain = gain;
		for ( var i = 0; i < total; i++ )
			this.tracks[i].gain( this.tracks[i].gain() );
	};

/////////////TRACKZ

	Track = function(name, opts, mix){
		
		var self = this,
			defaults = {
				gain:0,
				pan: 0
			};
     

		this.options = Mix.prototype.extend.call(this, defaults, opts || {});
		this.name = name;
		this.events = {};
		this.ready = false;
		this.set('mix', mix);
		this.set('muted', false);
		this.set('soloed', false);
		this.set('afl', true);
		this.set('currentTime', 0);
		this.set('nolooping', this.options.nolooping);
		this.set('gainNode', this.get('mix').context.createGain());
		this.set('panner', this.get('mix').context.createPanner());
		//this.get('panner').panningModel = webkitAudioPannerNode.EQUALPOWER;
		this.get('panner').setPosition(this.pan(),0,.1);
		this.set('analyser', this.get('mix').context.createAnalyser());
		this.get('analyser').smoothingTimeConstant = 0.60;
		this.get('analyser').fftSize = 128;
		this.set('processor', this.get('mix').context.createScriptProcessor(2048, 1, 1));
		this.set('gainCache', this.gain());
		this.set('gain', this.gain());
		this.set('freqByteData', new Uint8Array(this.get('analyser').frequencyBinCount));

		this.get('processor').onaudioprocess = function(){
			self.audioProcess();
		}

		this.loadDOM( this.get('source'));

		/*
		if ( this.get('buffer') ) {
			this.loadBuffer( this.get('source'));
		}else{
			this.loadDOM( this.get('source'));
		}
		*/
					
  }





	Track.prototype.loadDOM = function( source ){
 
		var self = this;
		
		self.set('element', document.createElement('audio'));
				
		self.get('element').src = source;

		self.get('element').looping = true

		self.get('element').load();

		console.log(source);

		var buf = self.get('element').buffered;

		var numRanges = buf.length;


		self.get('element').addEventListener("waiting", function () {
         console.log("waiting" + self.name)
         }, false);


		self.get('element').addEventListener("stalled", function () {
         console.log("stalled" + self.name)
         }, false);

		self.get('element').addEventListener('loadedmetadata', function(){
			
			self.set('source', self.get('mix').context.createMediaElementSource(self.get('element')));
			self.get('source').connect(self.get('panner'));
			self.get('panner').connect(self.get('gainNode'));
			self.get('gainNode').connect(self.get('mix').context.destination);
			self.get('source').connect(self.get('analyser'));
			self.get('analyser').connect(self.get('processor'));
			self.get('processor').connect(self.get('source').context.destination);
			self.ready = true;
			self.get('mix').trigger('load', self);
			//buildBoids(self.get('freqByteData').length)

	   }, false);


	   
	};

	
	Track.prototype.play = function(){

	
		if ( !this.ready ){
			this.on('load', function(){
				this.play();
			});
			return;
		}
		if ( this.options.playing ) return;
		
		this.gain(this.options.gain)

		this.options.playing = true;	

		this.options.source.noteOn(0);
		
		this.trigger('play');
		/**/
	};

	Track.prototype.playDOM = function(_gain){
		if ( !this.ready ){
			this.on('load', function(){
				this.play();
			});
			return;
		}
		this.gain(this.options.gain)
		if ( this.options.playing ) return;
		//this.options.source.mediaElement.currentTime = master.playHeadPos;
		this.options.source.mediaElement.play();
		this.options.playing = true;
		this.trigger('play');
	};


	Track.prototype.pause = function(){
		if(this.options.source.mediaElement){
		this.options.source.mediaElement.pause();
		this.options.playing = false;
		this.trigger('pause');
	}
	};


	Track.prototype.audioProcess = function(){

		var values = 0, average, hi, mid, lo, length = this.get('freqByteData').length;

		this.get('analyser').getByteFrequencyData(this.get('freqByteData'));

		//overall 
		for ( var i = 0; i < length; i++ ){
			values += this.get('freqByteData')[i];
			//boidSoundValue[i] = this.get('freqByteData')[i]
		}
		average = values / length;
		if ( this.get('afl') ) average = average * this.gain() * this.get('mix').gain;
		
		//lo

		values = 0;

		for ( var i = 0; i < length/3; i++ ){
			values += this.get('freqByteData')[i];
		}
		lo = values / (length/3);
		if ( this.get('afl') ) lo = lo * this.gain() * this.get('mix').gain;

		//mid

		values = 0;

		for ( var i = length/3; i < length/1.5; i++ ){
			values += this.get('freqByteData')[i];
		}
		mid = values / (length/3);
		if ( this.get('afl') ) mid = mid * this.gain() * this.get('mix').gain;		


		//mid

		values = 0;

		for ( var i = length/1.5; i < length; i++ ){
			values += this.get('freqByteData')[i];
		}
		hi = values / (length/3);
		if ( this.get('afl') ) hi = hi * this.gain() * this.get('mix').gain;

		this.set('lo', lo);
		this.get('mix').trigger('lo', self);
		this.trigger('lo', average);

		this.set('mid', average);
		this.get('mix').trigger('mid', self);
		this.trigger('mide', average);		

		this.set('hi', average);
		this.get('mix').trigger('hi', self);
		this.trigger('hi', average);

		this.set('averagevolume', average);
		this.get('mix').trigger('averagevolume', self);
		this.trigger('averagevolume', average);
	};

	
  ////////TRACKS UTILITIES

Track.prototype.on = function(){
		on.apply(this, arguments);
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Unind all events of a given type from a Track instance
	Track.prototype.off = function(){
		off.apply(this, arguments);
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Trigger events on a Track instance
	Track.prototype.trigger = function(){
		trigger.apply(this, arguments);
	}
	
	Track.prototype.trigger = function(){
		trigger.apply(this, arguments);
	}
		  
	Track.prototype.get = function(prop){
		return this.options[prop];
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Set a property value for a Track instance
	Track.prototype.set = function(prop, val){
		if ( typeof val === 'undefined' ) return;
		this.options[prop] = val;
		return this.options[prop];
	};
	

	Track.prototype.pan = function(val){
		if ( typeof val !== 'undefined' ) 
			this.get('panner').setPosition(val, 0, .1);
		this.set('pan', val)
		return this.get('pan') || 0;
	};


		//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Solo an instance of Track
	Track.prototype.solo = function(){
		if ( this.get('muted') ) this.unmute();
		this.set('soloed', true);
		this.get('mix').soloed += 1;
		this.trigger('solo');
		this.get('mix').trigger('soloMute', this);
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Unsolo an instance of Track
	Track.prototype.unsolo = function(){
		this.set('soloed', false);
		this.get('mix').soloed -= 1;
		this.trigger('unsolo');
		this.get('mix').trigger('soloMute', this);
	};


	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Mute an instance of Track
	Track.prototype.mute = function(){
		if ( this.get('soloed') ) this.unsolo();
		this.set('muted', true);
		this.trigger('mute');
		this.get('mix').trigger('soloMute', this);
	};
	
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Unmute an instance of Track
	Track.prototype.unmute = function(){
		this.set('muted', false);
		this.trigger('unmute');
		this.get('mix').trigger('soloMute', this);
	};	
	

	Track.prototype.gain = function(val, override){
		var min = 0, max = 1, master = this.get('mix').gain;
		if ( typeof val !== 'undefined' && val >= min && val <= max ){
			this.set('gain', val);
			if ( !override ) this.set('gainCache', val);
			if ( !this.get('_muted') || override ) this.get('gainNode').gain.value = val * master;
		}
		return this.get('gain') || this.get('gainNode').gain.value;
	};
		
	//~~~~~~~~~~~~~~~~~~~~~~~~~
	// Return a reference to the Track instance's parent Mix (no setter)
	Track.prototype.mix = function(){
		return this.get('mix');
	} 
	
	window.Mix = Mix;
	
}(window));
