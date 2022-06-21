function httpGetAsync(theUrl, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous 
    xmlHttp.send(null);
}

var colorPalette = {
    '-1.0': [43, 131, 186, 1.0],
    '-0.5': [171, 221, 164, 1.0],
    '0.0': [255, 255, 255, 1.0],
    '0.5': [253, 174, 97, 1.0],
    '1.0': [215, 25, 28, 1.0],
};

function formatUnixTime(timestamp) {
    var date = new Date(timestamp);
    var now = Date.now();
    var diff = new Date(now - date);


    // Will display time in 10:30 format
    return diff.getMinutes() + " minutes ago.";
}

function lerpCols(col2, col1, x) {
    var colRet = new Array(4);
    for (var i = 0; i < 4; i++) {
        colRet[i] = col1[i]*x + col2[i]*(1.0-x);
    }
    return colRet;
}

function lerpPalette(x) {
    var ret = colorPalette['-1.0']
    if (x > -1.0 && x < -0.5) {
        ret = lerpCols(colorPalette['-1.0'], colorPalette['-0.5'], (x + 1)*2);
    }
    else if (x < 0.0) {
        ret = lerpCols(colorPalette['-0.5'], colorPalette['0.0'], (x + 0.5)*2);
    }
    else if (x < 0.5) {
        ret = lerpCols(colorPalette['0.0'], colorPalette['0.5'], (x)*2);
    }
    else {
        ret = lerpCols(colorPalette['0.5'], colorPalette['1.0'], (x - 0.5)*2);
    }
    return ret;
}

const tempNear = function(feature) {
    var cross = new ol.style.Style({
            image: new ol.style.RegularShape({
                fill: new ol.style.Fill({color: 'red'}),
                stroke: new ol.style.Stroke({
                    color: lerpPalette(feature.get('stationValue') / 30), 
                    width: 3
                }),
                points: 4,
                radius: 10,
                radius2: 0,
                angle: (feature.get('stationValue') / 30) * (Math.PI/4),
            }),
            text: new ol.style.Text({
                font: '20px sans',
                text: feature.get('stationValue') + "°C",
                offsetX: 20,
                offsetY: -20,
                fill: new ol.style.Fill({
                  color: lerpPalette(feature.get('stationValue') / 30)
                })
            }),
        });
    return [cross];
}

const tempFar = function(feature) {
    var cross = new ol.style.Style({
            image: new ol.style.RegularShape({
                fill: new ol.style.Fill({color: 'red'}),
                stroke: new ol.style.Stroke({
                    color: lerpPalette(feature.get('stationValue') / 30), 
                    width: 3
                }),
                points: 4,
                radius: 10,
                radius2: 0,
                angle: (feature.get('stationValue') / 30) * (Math.PI/4),
            })
        });
    return [cross];
}


var vectorSource = new ol.source.Vector({
    features: []
});

var vectorLayer = new ol.layer.Vector({
    source : vectorSource,
    style : tempFar
})


var map = new ol.Map({
    target: 'map',
    controls: ol.control.defaults({
        attributionOptions: ({
            collapsible: false
        })
    }),

    layers: [
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: "https://api.maptiler.com/maps/basic-dark/{z}/{x}/{y}.png?key=L5nAdce4BguwWGwEyUgZ",
                tileSize: 512,
                crossOrigin: 'anonymous',

                attributions:'<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a> <a href="https://www.smhi.se/data/oppna-data/villkor-for-anvandning-1.30622" target="_blank">&copy; SMHI</a> | Map by <a href="https://github.com/JmsPae" target="_blank">James P</a>',
            }),
        }),

        vectorLayer
    ],
    view: new ol.View({
        center: ol.proj.fromLonLat([15.713, 62.508]),
        zoom: 5
    })
});

var popup = new Popup();
map.addOverlay(popup);

map.on('moveend', function(evt) {
    if (evt.map.getView().getZoom() > 7) {
        vectorLayer.setStyle(tempNear);
    }
    else {
        vectorLayer.setStyle(tempFar);
    }
});

map.on('singleclick', function(evt) {
    var feat = null;
    
    map.forEachFeatureAtPixel(evt.pixel, 
        function(feature, layer) {
            feat = feature;
        },
        { hitTolerance: 10 }
    );

    if (feat != null) {
        var str = '<div><b>'+feat.get('stationName')+'</b><br>';
        str += feat.get('stationValue') + '°C<br>'
        str += formatUnixTime(feat.get('stationValueDate')) + '</div>';

        popup.show(feat.getGeometry().getCoordinates(), str);
    }
    else {
        popup.hide()
    }
});

function onGetData(response) {
    station_list = JSON.parse(response)['station'];

    for (var key in station_list) {
        if (station_list.hasOwnProperty(key)) {
            station = station_list[key];
            if (station['value'] != null) {

                vectorSource.addFeature(new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([station['longitude'], station['latitude']])),
                    stationName: station['name'],
                    stationValue: station['value'][0]['value'],
                    stationValueDate: station['value'][0]['date']
                }));
                
                console.log(station);
            }
        }
    }
}

httpGetAsync("https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/1/station-set/all/period/latest-hour/data.json", onGetData);

