var Marker = React.createClass({

  getInitialState: function () {
    return {currentMarker: null, gems: [], currentLoc: ""};
  },

  //for first time rendering
  componentDidMount: function () {
    this.setState({currentLoc: this.props.loc});
  },

  componentWillReceiveProps: function (nextProps) {
    //check for glitches
    if (nextProps.loc != this.props.loc)
      this.setState({currentLoc: nextProps.loc});
  },

  //once state with current location, place it on the map
  componentDidUpdate: function (prevProps, prevState) {
    if(prevState.currentLoc != this.state.currentLoc)
      this.addMarker();
  },

  addMarker: function (place) {

      //var lat = place.geometry.location.lat();  
      //var lng = place.geometry.location.lng(); 

      //create a new marker object to be placed on map
      var marker = new google.maps.Marker({
        //I'm getting the map from Map
              map: this.props.map,
              position: new google.maps.LatLng(this.props.lat, this.props.lng),
              //position: place.geometry.location,
              title: this.props.loc 
      });

      console.log("marker added"); 

      marker.infoBox = new google.maps.InfoWindow({
        content: "marker added successfully" 
      });

      //extend map as markers are added
      //TODO do in the map
      this.props.extendMap(this.props.bounds, this.props.lat, this.props.lng);

      this.setState({currentMarker: marker});

      //add event listner
      google.maps.event.addListener(marker,'click',function() {          
          marker.setVisible(false);
          this.gotoLocation(); //zoom into the location
      }.bind(this)); 

  },

  //TODO do in the server
  decodeLoc: function () {
    //this.setState({stopAdding: true});
    //get the place
    var address = this.props.loc; 
    var service = new google.maps.places.PlacesService(this.props.map);        
    var request = {query: address};
    //make an async call to decode the address, after which a
    //callback functin is make to add the marker
    service.textSearch(request, function (results, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          this.setState({currentMarker: this.addMarker(results[0])});
        }
    }.bind(this)); 
  },
   
  //this function is called when location is clicked
  gotoLocation: function () {
    
    var marker = this.state.currentMarker;
    var point = marker.getPosition();
    //TODO hard code for now
    this.props.map.setZoom(15);
    this.props.map.panTo(marker.getPosition());

    //TODO make max radius a state
    var streetViewMaxDistance = 100;          
    //make point a state
    var streetViewService = new google.maps.StreetViewService();
    //setup a local variable
    var panorama = this.props.panorama;
    
    var safety = 0;
    
    var that = this;
    var getPanorama = function (streetViewPanoramaData, status) {

        //TODO fix and finish
        var drawLine = function(op,p) {
          //connect the two lines 
          var line = new google.maps.Polyline({
            path: [op, p],
            strokeColor: "#FF0000",
            strokeOpacity: 1.0,
            strokeWeight: 10,
            map: that.props.map
          });
        };
      
        if (status === google.maps.StreetViewStatus.OK) {

          //TODO fix
          var oldPoint = point;
          point = streetViewPanoramaData.location.latLng;

          //TODO this is a hack for now
          var newLat = point.lat()+0.0002;
          var newLng = point.lng();

          var _GREEN = 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
          var _INDIANA = 'img/indiana.jpg';

          var target = new google.maps.Marker({
              position: new google.maps.LatLng(newLat, newLng),
              //position: point,
              map: this.props.map,
              title: streetViewPanoramaData.location.description,
              icon: _GREEN
          });
          
          //drawLine(marker.getPosition(), target.getPosition());

          //from google maps api docs: Returns the heading from one LatLng to another LatLng.
          //Headings are expressed in degrees clockwise from North within the range [-180,180).
          //TODO bug with heading computation
          //var heading = google.maps.geometry.spherical.computeHeading(point, oldPoint);            
          panorama.setPano(streetViewPanoramaData.location.pano);
          panorama.setPosition(point);
          panorama.setPov({
              heading: 0,
              zoom: 1,
              pitch: 0
          });
          panorama.setVisible(true);

          google.maps.event.addListener(target, 'click', function() {
              //here call the question
              that.props.renderQuestions();
              //set icon to flag and set to unclickable
              target.setClickable(false);
              //panorama.setVisible(false);
          });

        } else { 

          if (safety < 5) {
            safety += 1;
            console.log("trying: "+safety);
            streetViewMaxDistance = streetViewMaxDistance*2;

            streetViewService.getPanoramaByLocation(point, streetViewMaxDistance, getPanorama);
          } else {
            console.log("Sorry, couldn't find panorama view within"+streetViewMaxDistance+"meters")
          }
          
        }

    }.bind(this);

    streetViewService.getPanoramaByLocation(point, streetViewMaxDistance, getPanorama);
    
  },

  render: function () {
    //return null since not creating new html elements
    return null;
  }

}); 

var Map = React.createClass({
 
  getInitialState: function () {
    return {map: null, 
            mapBounds: null, 
            panorama: null};
  },
   
  componentDidMount: function () {
    this.setState({map: this.createMap()}); 
    this.setState({mapBounds: this.setMapBounds()});
  
  },

  setMapBounds: function () {
    return new google.maps.LatLngBounds();
  },

  setPanoramaView: function(bool) {
    this.state.panorama.setVisible(bool);
  },

  createMap: function () {
    
    var mapOptions = {
          //center: new google.maps.LatLng(41.9, 12.5),
          //zoom: 4
        };

    //create map object 
    var map = new google.maps.Map(this.refs.map_canvas.getDOMNode(), mapOptions);

    //set panorama
    this.setState({panorama: map.getStreetView()});

    /**
     * The following code to keep map centered when reizing window was taken from
     * the following stackoverflow link:
     * http://stackoverflow.com/questions/23947904/keep-google-maps-centered-when-window-resize
     */
    //TODO review this code
    google.maps.event.addListener(map, 'center_changed', function() {
	    var size = [this.getDiv().offsetWidth,this.getDiv().offsetHeight].join('x');
	    if( !this.get('size') || size === this.get('size')){
	       this.setValues({size:size,_center:this.getCenter()});         
	    }
	    else{
	      google.maps.event.addListenerOnce(this,'idle',function(){
	      this.setValues({size:size,center:this.get('_center')});});      
	    }
    });
    google.maps.event.trigger(map,'center_changed',{});

    return map; 
  
  },

  resizeMap: function (bounds, lat, lng) {
    if(lat !== undefined && lng !== undefined)
	    bounds.extend(new google.maps.LatLng(lat, lng));

    var map = this.state.map;
	  map.fitBounds(bounds);
	  map.setCenter(bounds.getCenter());

    if (map.getZoom() > 8)
      map.setZoom(8);

    this.setState({map: map});
  },

  toggleStreetView: function () {
    var toggle = this.state.panorama.getVisible();
    if (toggle == true)
      this.state.panorama.setVisible(false); 
    else
      this.state.panorama.setVisible(true);  
  },

  resetView: function () {
    this.state.panorama.setVisible(false);
  },

  render: function () {
    
    //I'm having a list of markers and I'm passing them the lat and lon and the
    //map state
    if(this.props.resetMap)
       this.resetView();
    
    var markers;
    if(this.state.map) {
      //
      markers = <Marker loc={this.props.loc} lat={this.props.lat} lng={this.props.lng}
                        renderQuestions = {this.props.renderQuestions}
                        proceed = {this.props.resetMap}
                        map={this.state.map} 
                        sendMarkers={this.sendMarkers}
                        panorama={this.state.panorama} 
                        extendMap={this.resizeMap} 
                        bounds={this.state.mapBounds} />;
    } else {

      markers = null;

    }

    //I'm just puting markers there in order to have render on the map
    var style = {height: "500px", width: "800px"};
    var button = <div id="panel" >
                    <input type="button" value="Toggle Street View" onClick={this.toggleStreetView}/>
                 </div>;
    return  <div>
              {button}
              <div style={style} ref="map_canvas">
                {markers}
              </div>
            </div>;
  }

});
