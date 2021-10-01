$(document).ready(function() {

    // Initialise variables
    let mapMarkerIcon, tooltip, carouselItemClass, wikiCaption, wikiEndPos, wikiAttribution, wikiFullAttribution, wikiLicense, forecastDate;
    const errorText = "Unavailable", noDataText = "None";
    const errorTranslationText = 'Translation unavailable for English-speaking countries.';

    // Initialise Bootstrap tooltips
    $('[data-toggle="tooltip"]').tooltip();

    // Create the map and set arbitrary default view
    // Set 'tap' property to false - workaround for Leaflet 1.7.1 bug #7255
    // causing two click events to be emitted by Leaflet controls in Safari
    const gazetteerMap = new L.Map('gazetteerMap', { "tap": false }).setView([51.505, -0.09], 5);

    // Attribution for using Esri WorldStreetMap tiles
    const attribution = 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012';

    // Create the tiles for the map
    const tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
    const tiles = L.tileLayer(tileUrl, {
        attribution: attribution,
        maxZoom: 18
    });
    tiles.addTo(gazetteerMap);

    // Populate the country selection dropdown
    $.ajax({
        type: 'GET',
        url: 'resources/php/getCountryList.php',
        dataType: 'json',
        success: function(countries) {

            if (countries.status.result == "OK") {
                // Populate the country dropdown - 'value' attribute is the ISO2 country code
                // Store the ISO3 code as a data attribute for any integration that only works with ISO3
                $.each(countries.data, function (key, country) {
                    $('#countryDropdownList').append($('<option></option>').attr('value', country.iso2).attr('data-iso3', country.iso3).text(country.name));
                });
            }
        }
    });

    // Populate the currency selection dropdowns
    $.ajax({
        type: 'GET',
        url: 'resources/php/getCurrencyList.php',
        dataType: 'json',
        success: function(currencies) {

            if (currencies.status.result == "OK") {
                // Populate the 'from' and 'to' currency dropdowns - 'value' attribute is the currency code
                $.each(currencies.data, function (key, currency) {
                    $('#currencyFromDropdownList').add('#currencyToDropdownList').append($('<option></option>').attr({
                        'value': currency.code,
                        'data-name': currency.name
                    }).text(currency.name + ' (' + currency.code + ')'));
                });

                // Default the 'convert from' currency to GBP
                $('#currencyFromDropdownList').val('GBP');
            }
        }
    });

    /* ============================================= */
    /* REMOVE PRELOADER FROM THE SCREEN */
    /* ============================================= */
    const removeLoadingScreen = () => {
        if ($('#preloader').length) {
            $('#preloader').fadeOut(500, function() {
                // Show the 'START HERE' tooltip if this is the first time the app has loaded
                // The tooltip is permanently removed after it has been hidden for the first time
                if ($('.map-help-button').attr('data-toggle')) {
                    $('.map-help-button').tooltip('show');
                }
            });        
        }
    };

    /* ============================================= */
    /* GET ALL GEOGRAPHIC DATA */
    /* 1. Can be called with lat/lng coordinates if fetching data on first load from user's location */
    /* 2. Can be called with a specific country and ISO2 code when user selects a country from the dropdown */
    /* ============================================= */
    const getAllGeoData = ({iso2=false, country=false, lat=false, lng=false} = {}) => {
        const inputData = {
            'country': country,
            'iso2': iso2,
            'lat': lat,
            'lng': lng
        };

        $.ajax({
            type: 'GET',
            url: 'resources/php/getAllGeoData.php',
            data: inputData,
            dataType: 'json',
            success: function(data) {

                if (data.status.result == "OK") {
                    // Get the data from each API response
                    const openCageData = data.openCage;
                    const hereData = data.here.results.items;
                    const restCountriesData = data.restCountries;
                    const wikipediaText = data.wikipediaText;
                    const wikipediaImages = data.wikipediaImages;
                    const openWeatherData = data.openWeather;
                    const holidaysData = data.holidays;
                    const webcamsData = data.webcams;

                    // Set the boundaries of the country from the OpenCage data
                    const bounds = [
                        [openCageData.bounds.northeast.lat, openCageData.bounds.northeast.lng],
                        [openCageData.bounds.southwest.lat, openCageData.bounds.southwest.lng]
                    ];

                    // Build the content for the country info modals
                    buildCountryInfo(restCountriesData, wikipediaText, wikipediaImages, openWeatherData, holidaysData, webcamsData);

                    // Update the map using the returned data
                    $('#countryDropdownList').val(openCageData.components['ISO_3166-1_alpha-2']);
                    updateMap(openCageData.components['ISO_3166-1_alpha-2'], openCageData.geometry.lat, openCageData.geometry.lng, bounds, hereData);
                } else {

                    // Error returned
                    // Log the error, remove the preloader from the screen and show the error modal
                    console.log(data);
                    removeLoadingScreen();
                    $('#errorModal').modal('show');
                }
            }
        });
    };

    /* ============================================= */
    /* UPDATE THE MAP */
    /* ============================================= */
    const updateMap = (iso2, lat, lng, bounds, mapMarkers) => {

        // First remove any existing layers from the map
        gazetteerMap.eachLayer(function(layer) {
            if (layer instanceof L.LayerGroup) gazetteerMap.removeLayer(layer);
        });

        // Create a Feature Group and add the country border
        $.ajax({
            type: 'GET',
            url: 'resources/php/getCountryBorder.php',
            data: { 'iso2': iso2 },
            dataType: 'json',
            success: function(countryFeature) {

                if (countryFeature.status.result == "OK") {
                    // Add the country Feature to a Feature Group and add the layer to the map
                    L.featureGroup([
                        L.geoJSON(countryFeature.data, {
                            color: '#4169E1',
                            fillColor: '#0F417E',
                            fillOpacity: '0.06'
                        })
                    ]).addTo(gazetteerMap);        
                }
            }
        });

        // Set the latitude/longitude for the map view and scale map to fit country boundaries
        gazetteerMap.setView([lat, lng], 13);
        gazetteerMap.fitBounds(bounds);

        // Create a 'Points Of Interest' marker layer
        const poiMarkers = L.markerClusterGroup();
        for (let mapMarker in mapMarkers) {

            // Create the icon for the current map marker
            mapMarkerIcon = L.icon({
                iconUrl: mapMarkers[mapMarker]["icon"],
                iconSize: [50, 60]
            });

            // Create the tooltip for the current map marker
            tooltip = `<strong>${mapMarkers[mapMarker].title}</strong><br>
                (${mapMarkers[mapMarker].category.title})`;

            // Add opening hours to tooltip if this marker supports it
            if ('openingHours' in mapMarkers[mapMarker]) {
                tooltip += `<br><br>Opening Hours:<br>
                ${mapMarkers[mapMarker].openingHours.text}`;
            }

            // Add the marker to the map with a click event
            // to show additional information in a modal popup
            poiMarkers.addLayer(
                L.marker(mapMarkers[mapMarker]["position"], {
                    icon: mapMarkerIcon
                }).bindTooltip(tooltip, {className: 'marker-tooltip'})
                .on('click', function() {

                    /* =============================================== */
                    /* CREATE THE MODAL CONTENT FOR THE CURRENT MARKER */
                    /* =============================================== */

                    // Remove/hide any existing content from the last time the modal was displayed
                    $('#marker-carousel .carousel-indicators').empty();
                    $('#marker-carousel .carousel-inner').empty();
                    $('#marker-modal-body').children().addClass('hide');

                    // Set the content of the modal popup containing additional marker information
                    $('#marker-modal-title').html(`${mapMarkers[mapMarker].title}<br>
                        <em>(${mapMarkers[mapMarker].category.title})</em>`);

                    if ('openingHours' in mapMarkers[mapMarker]) {
                        $('#marker-opening-hours').html(`<strong>Opening Hours:</strong><br>${mapMarkers[mapMarker].openingHours.text}`);
                        $('#marker-opening-hours').removeClass('hide');
                    }

                    // Call the HERE API again, using the 'additional data' URL passed back in the first result,
                    // to get additional information for the modal - contact details, photos, etc.
                    $.ajax({
                        type: 'GET',
                        url: 'resources/php/getMarkerData.php',
                        data: { 'hereMarkerUrl': mapMarkers[mapMarker]['href'] },
                        dataType: 'json',
                        success: function(data) {

                            if (data.status.result == "OK") {
                                // Get the additional HERE marker data from the result
                                const hereMarkerData = data.data;

                                // Get the address of the marker, if it is available
                                if ('address' in hereMarkerData.location) {
                                    $('#marker-address').html(`<strong>Address:</strong><br>${hereMarkerData.location.address.text}`);
                                    $('#marker-address').removeClass('hide');
                                }

                                // Get the phone number and website of the marker, if they are available
                                if ('contacts' in hereMarkerData) {
                                    if ('phone' in hereMarkerData.contacts) {
                                        $('#marker-phone').html(`<strong>Phone No:</strong><br>${hereMarkerData.contacts.phone[0].value}`);
                                        $('#marker-phone').removeClass('hide');
                                    }

                                    if ('website' in hereMarkerData.contacts) {
                                        $('#marker-website').html(`<strong>Website:</strong><br>
                                            <a href='${hereMarkerData.contacts.website[0].value}' target='_blank'>${hereMarkerData.contacts.website[0].value}</a>`);
                                            $('#marker-website').removeClass('hide');
                                    }
                                }

                                // If photos are available, create an image carousel
                                if ('media' in hereMarkerData) {
                                    // Create an array of the image sources so they can be preloaded before the modal is shown
                                    let markerImages = [];

                                    if ('images' in hereMarkerData.media && hereMarkerData.media.images.items.length > 0) {

                                        // Loop through the images and add them to the carousel
                                        for (let i = 0; i <= hereMarkerData.media.images.items.length - 1; i++) {

                                            markerImages.push(hereMarkerData.media.images.items[i].src);

                                            // Add the current image to the carousel
                                            carouselItemClass = i === 0 ? 'carousel-item active' : 'carousel-item';
                                            $('#marker-carousel .carousel-inner').append(
                                                `<div class="${carouselItemClass}">
                                                    <img 
                                                        src="${hereMarkerData.media.images.items[i].src}" 
                                                        class="d-block m-auto" 
                                                        alt="${mapMarkers[mapMarker].title}" 
                                                        aria-label="${mapMarkers[mapMarker].title}" 
                                                        data-attribution="${htmlEntities(hereMarkerData.media.images.items[i].attribution, 'escape')}">
                                                </div>`
                                            );

                                            // Add the current image to the carousel image number indicators
                                            if (i === 0) {
                                                // First image - set the 'active' attribute and the initial image attribution
                                                $('#marker-carousel .carousel-indicators').append(`<li data-target="#marker-carousel" data-slide-to="${i}" class="active"></li>`);
                                                $('#marker-photo-attribution').html(hereMarkerData.media.images.items[i].attribution);
                                            } else {
                                                $('#marker-carousel .carousel-indicators').append(`<li data-target="#marker-carousel" data-slide-to="${i}"></li>`);
                                            }

                                        }

                                        // If there is more than one image in the carousel, show the navigation buttons
                                        if (hereMarkerData.media.images.items.length > 1) {
                                            $('#marker-carousel .carousel-indicators').add('#marker-carousel a').removeClass('hide');
                                        } else {
                                            $('#marker-carousel .carousel-indicators').add('#marker-carousel a').addClass('hide');
                                        }

                                        // Show the image carousel
                                        $('#marker-slideshow').removeClass('hide');

                                        // Preload the images before the marker modal is shown
                                        $('#preloader').fadeIn(300);
                                        preloadMarkerImages(markerImages);    
                                    }
                                }

                                // Display the POI marker modal on screen
                                if (!$('#preloader').is(':visible')) {
                                    $('#markerModal').modal('show');
                                }
                            }
                        }
                    });

                })
            );
        };

        // Add the POI markers to the map
        gazetteerMap.addLayer(poiMarkers);

        // App is ready - remove the preloader from the screen
        removeLoadingScreen();

    };

    /* ============================================= */
    /* BUILD THE CONTENT FOR THE COUNTRY INFO MODAL  */
    /* ============================================= */
    const buildCountryInfo = (countryInfo, wikipediaText, wikipediaImages, weather, holidays, webcams) => {

        /* ============================================= */
        /* GENERAL COUNTRY INFORMATION CARD */
        /* ============================================= */

        // Remove any image elements from the last time the modal was shown
        $('#modal-card-country-flag').empty();

        let countryFlag = $(document.createElement('img'));
        countryFlag.attr('src', `https://flagcdn.com/${countryInfo.alpha2Code.toLowerCase()}.svg`);
        countryFlag.attr('alt', `Flag of ${countryInfo.name}`);
        countryFlag.attr('aria-label', `Flag of ${countryInfo.name}`);
        countryFlag.appendTo('#modal-card-country-flag');

        const countryName = countryInfo.name ? countryInfo.name : errorText;
        const countryRegion = countryInfo.subregion ? countryInfo.subregion : errorText;
        const countryArea = countryInfo.area ? `${formatNumber(countryInfo.area)} km<sup>2</sup>` : errorText;
        const countryCapitalCity = countryInfo.capital ? countryInfo.capital : errorText;
        const countryPopulation = countryInfo.population ? formatNumber(countryInfo.population) : errorText;

        // Build borders list
        let borderName = '', bordersList = '';
        $.each(countryInfo.borders, function (key, border) {
            // Get the country name from the ISO3 code
            borderName = $(`#countryDropdownList option[data-iso3='${border}']:first`).text();
            if (borderName) {
                if (key === 0 || !bordersList) {
                    bordersList += borderName;
                } else {
                    bordersList += `, ${borderName}`;
                }
            }
        });
        bordersList = bordersList ? bordersList : noDataText;

        // Build currency list
        let currencyEntry = '', currencyList = '';
        $.each(countryInfo.currencies, function (key, currency) {
            if (currency.name && currency.code) {
                // Include the currency symbol, if it is available
                currencyEntry = 'symbol' in currency && currency.symbol ? `${currency.name} (${currency.symbol})` : currency.name;
                if (key === 0) {
                    currencyList += currencyEntry;
                    // Also use the first currency as the 'convert to' currency
                    // on the currency exchange card
                    $('#currencyToDropdownList').val(currency.code);
                } else {
                    currencyList += `, ${currencyEntry}`;
                }
            }
        });
        currencyList = currencyList ? currencyList : errorText;

        // Build language list
        let languageList = '';
        $('#translateOutputDropdownList').empty();
        $.each(countryInfo.languages, function (key, language) {
            // Add each language to the translation dropdown list (excluding English)
            if (language.iso639_1 !== 'en') {
                $('#translateOutputDropdownList').append($('<option></option>').attr('value', language.iso639_1).text(language.name));
            }
            if (key === 0) {
                languageList += language.name;
            } else {
                languageList += `, ${language.name}`;                
            }
        });
        languageList = languageList ? languageList : errorText;

        // Build Internet top-level domain list
        let domainList = '';
        $.each(countryInfo.topLevelDomain, function (key, domain) {
            if (key === 0) {
                domainList += `${domain}`;
            } else {
                domainList += `, ${domain}`;
            }
        });
        domainList = domainList ? domainList : errorText;

        // Build telephone calling code list
        let telephoneList = '';
        $.each(countryInfo.callingCodes, function (key, code) {
            if (key === 0) {
                telephoneList += `+${code}`;
            } else {
                telephoneList += `, +${code}`;
            }
        });
        telephoneList = telephoneList ? telephoneList : errorText;

        // Populate the Country Information card with data
        $('#country-modal-title').text(countryName);
        $('#modal-card-country-name').text(countryName);
        $('#modal-card-country-region').text(countryRegion);
        $('#modal-card-country-area').html(countryArea);
        $('#modal-card-country-borders').text(bordersList);
        $('#modal-card-country-capital').text(countryCapitalCity);
        $('#modal-card-country-population').text(countryPopulation);
        $('#modal-card-country-currency').text(currencyList);
        $('#modal-card-country-language').text(languageList);
        $('#modal-card-country-domain').text(domainList);
        $('#modal-card-country-tel').text(telephoneList);

        /* ============================================= */
        /* WIKIPEDIA CARD */
        /* ============================================= */

        // Remove any Wikipedia content from the last time the modal was shown
        $('#wiki-carousel').add('#wiki-carousel a').add('#modal-card-wiki-carousel-caption').addClass('hide');
        $('#wiki-carousel .carousel-indicators').empty();
        $('#wiki-carousel .carousel-inner').empty();        
        $('#modal-card-country-wikipedia').empty();
        if ($('#modal-card-country-wiki-link').attr('href')) {
            $('#modal-card-country-wiki-link').removeAttr('href');
            $('#modal-card-country-wiki-link').removeAttr('target');
            $('#modal-card-country-wiki-link').empty();
        }

        // Add photos returned from Wikipedia to the image carousel
        if (wikipediaImages.query.pages) {
            const wikiImageObject = wikipediaImages.query.pages;
            const wikiImageKeys = Object.keys(wikiImageObject);
            // Filter out icons, logos and other images that are not photos
            const wikiImageArray = wikiImageKeys.filter(imageKey => imageKey[0] === '-');
            // Use up to five images
            const wikiImagesToShow = wikiImageArray.length < 5 ? wikiImageArray.length - 1 : 4;

            if (wikiImagesToShow) {
                for (let i = 0; i <= wikiImagesToShow; i++) {

                    // Add the current image to the carousel
                    wikiCaption = 'ImageDescription' in wikiImageObject[wikiImageArray[i]].imageinfo[0].extmetadata ? wikiImageObject[wikiImageArray[i]].imageinfo[0].extmetadata.ImageDescription.value : 'Caption unavailable';

                    // Restrict Wikipedia image captions to 100 characters. Only break at the end of a word.
                    if (wikiCaption.length > 100) {
                        // Remove any HTML tags first, so truncating the text doesn't cause problems
                        wikiCaption = stripHtmlTags(wikiCaption);
                        // Check the length is still >100 after HTML tags have been stripped
                        if (wikiCaption.length > 100) {
                            wikiEndPos = wikiCaption.indexOf(' ', 100);
                            if (wikiEndPos > 0) wikiCaption = `${wikiCaption.substring(0, wikiEndPos)}.....`;
                        }
                    }

                    // Create the attribution text for the image caption
                    wikiAttribution = 'Artist' in wikiImageObject[wikiImageArray[i]].imageinfo[0].extmetadata ? wikiImageObject[wikiImageArray[i]].imageinfo[0].extmetadata.Artist.value : errorText;
                    wikiLicense = 'LicenseShortName' in wikiImageObject[wikiImageArray[i]].imageinfo[0].extmetadata ? wikiImageObject[wikiImageArray[i]].imageinfo[0].extmetadata.LicenseShortName.value : '';

                    if (wikiAttribution && wikiLicense) {
                        wikiFullAttribution = `${wikiAttribution}, ${wikiLicense}, via Wikimedia Commons`;
                    } else {
                        wikiFullAttribution = wikiAttribution;
                    }

                    // Add the current image to the carousel
                    carouselItemClass = i === 0 ? 'carousel-item active' : 'carousel-item';
                    $('#wiki-carousel .carousel-inner').append(
                        `<div class="${carouselItemClass}">
                            <a href="${wikiImageObject[wikiImageArray[i]].imageinfo[0]['descriptionshorturl']}" target="_blank">
                                <img 
                                    src="${wikiImageObject[wikiImageArray[i]].imageinfo[0]['thumburl']}" 
                                    class="d-block m-auto" 
                                    data-toggle="tooltip" 
                                    title="Click the image for more information" 
                                    alt="${wikiImageObject[wikiImageArray[i]].title}" 
                                    aria-label="${wikiImageObject[wikiImageArray[i]].title}" 
                                    data-caption="${htmlEntities(wikiCaption, 'escape')}" 
                                    data-attribution="${htmlEntities(wikiFullAttribution, 'escape')}">
                            </a>
                        </div>`
                    );

                    // Add the current image to the carousel image number indicators
                    if (i === 0) {
                        // First image - set the 'active' attribute and caption box
                        $('#wiki-carousel .carousel-indicators').append(`<li data-target="#wiki-carousel" data-slide-to="${i}" class="active"></li>`);
                        $('#modal-card-wiki-carousel-caption').html(`${wikiCaption}<br>Attribution: ${wikiFullAttribution}`);
                    } else {
                        $('#wiki-carousel .carousel-indicators').append(`<li data-target="#wiki-carousel" data-slide-to="${i}"></li>`);
                    }
                    
                }

                // If there is more than one image in the carousel, show the navigation buttons
                if (wikiImagesToShow > 0) {
                    $('#wiki-carousel .carousel-indicators').add('#wiki-carousel a').removeClass('hide');
                } else {
                    $('#wiki-carousel .carousel-indicators').add('#wiki-carousel a').addClass('hide');
                }

                // Show the image carousel and caption box
                $('#wiki-carousel').add('#modal-card-wiki-carousel-caption').removeClass('hide');
            }
        }

        // Add the Wikipedia text and external link
        if (wikipediaText && wikipediaText.extract_html) {
            $('#modal-card-country-wikipedia').html(wikipediaText.extract_html);

            if (wikipediaText.content_urls.desktop.page) {
                $('#modal-card-country-wiki-link').attr('href', wikipediaText.content_urls.desktop.page);
                $('#modal-card-country-wiki-link').attr('target', '_blank');
                $('#modal-card-country-wiki-link').append(wikipediaText.content_urls.desktop.page);
            }
        } else {
            $('#modal-card-country-wikipedia').append(errorText);
        }

        /* ============================================= */
        /* WEATHER FORECAST CARD */
        /* ============================================= */

        if (weather.daily && weather.daily.length >= 4) {
            for (let i = 0; i <= 3; i++) {
                // Set the icon and max/min temperatures for each day of the forecast
                $(`#forecast-icon-day-${i}`).attr('src', `https://openweathermap.org/img/wn/${weather.daily[i].weather[0].icon}@2x.png`);
                $(`#forecast-icon-day-${i}`).attr('alt', weather.daily[i].weather[0].description);
                $(`#forecast-icon-day-${i}`).attr('aria-label', weather.daily[i].weather[0].description);
                $(`#forecast-max-day-${i}`).html(`${Math.round(weather.daily[i].temp.max)}&#176`);
                $(`#forecast-min-day-${i}`).html(`${Math.round(weather.daily[i].temp.min)}&#176`);
                if (i > 1) {
                    // Get the date and month for days 3 and 4 from the Unix timestamp in the OpenWeather response
                    forecastDate = getDateFromTimestamp(weather.daily[i].dt);
                    $(`#forecast-title-day-${i}`).text(`${forecastDate[0]} ${forecastDate[1]}`);
                } else {
                    if (i === 0) $(`#forecast-title-day-${i}`).text('Today');
                    if (i === 1) $(`#forecast-title-day-${i}`).text('Tomorrow');
                }
            }
        } else {
            for (let i = 0; i <= 3; i++) {
                // Remove weather content from last time the modal was displayed
                $(`#forecast-icon-day-${i}`).removeAttr('src');
                $(`#forecast-icon-day-${i}`).removeAttr('alt');
                $(`#forecast-icon-day-${i}`).removeAttr('aria-label');
                $(`#forecast-max-day-${i}`).text('');
                $(`#forecast-min-day-${i}`).text('');
                $(`#forecast-title-day-${i}`).text(errorText);
            }
        }

        /* ============================================= */
        /* CURRENCY EXCHANGE CARD */
        /* ============================================= */

        // Hide the results data until an exchange has been calculated
        $('#currency-results').children().addClass('hide');

        // Reset the input amount and default the 'from' currency to 'GBP'
        $('#currencyAmountInput').val('1.00');
        $('#currencyFromDropdownList').val('GBP');

        /* ============================================= */
        /* TRANSLATION CARD */
        /* ============================================= */

        // Reset fields from previous translations until input text is entered
        $('#translateInputText').add('#translateOutputText').add('#translateOutputDropdownList').prop('disabled', false);
        $('#translateInputText').add('#translateOutputText').val('');
        $('#translate-char-limit').text('0 / 500');
        $('#translateOutputText').attr('readonly', 'readonly');
        $('#translate-button').prop('disabled', true);

        // Translation unavailable for English-speaking countries
        if ($('#translateOutputDropdownList option').length < 1) {
            $('#translateOutputDropdownList').append($('<option></option>').text(`-- ${errorText} --`));
            $('#translateInputText').add('#translateOutputText').val(errorTranslationText);
            $('#translateOutputText').removeAttr('readonly');
            $('#translateInputText').add('#translateOutputText').add('#translateOutputDropdownList').prop('disabled', true);
        }

        /* ============================================= */
        /* PUBLIC HOLIDAYS CARD */
        /* ============================================= */

        let holidayName, holidayWikiLink;

        // Clear holiday entries from last time modal was shown
        if ($('#holidays-unavailable').hasClass('hide')) $('#holidays-unavailable').removeClass('hide');
        if (!$('#holidays-table').hasClass('hide')) $('#holidays-table').addClass('hide');
        $('#holidays-table tbody').empty();

        if (holidays.length > 0) {
            // Build the list of public holidays
            $.each(holidays, function (key, holiday) {

                // If holiday name is in local language, include English name
                holidayName = holiday.localName == holiday.name ? holiday.localName : `${holiday.localName} (${holiday.name})`;

                // Create a Wikipedia link
                holidayWikiLink = encodeURI(`https://en.wikipedia.org/wiki/${holiday.name}`);

                // Add a row to the table for the current holiday
                $('#holidays-table tbody')
                    .append($('<tr></tr>')
                    .attr('data-id', key));
                $('#holidays-table tbody')
                    .find(`tr[data-id=${key}]`)
                    .append($('<td></td>')
                    .text(formatDate(new Date(holiday.date))))
                    .append($('<td></td>'));
                $('#holidays-table tbody').find(`tr[data-id=${key}]`).children().last()
                    .append($('<a></a>')
                    .attr({
                        'href': holidayWikiLink,
                        'target': '_blank'
                    })
                    .text(holidayName));
            });

            // Show the public holidays table
            if (!$('#holidays-unavailable').hasClass('hide')) $('#holidays-unavailable').addClass('hide');
            if ($('#holidays-table').hasClass('hide')) $('#holidays-table').removeClass('hide');
        }

        /* ============================================= */
        /* WEBCAMS CARD */
        /* ============================================= */

        $('#webcam-0').add('#webcam-1').add('#webcam-2').addClass('hide');
        $('#webcam-name-0').add('#webcam-name-1').add('#webcam-name-2').addClass('hide');
        if ($('#webcams-unavailable').hasClass('hide')) $('#webcams-unavailable').removeClass('hide');

        // Create the webcam timelapse players
        if (webcams.data && webcams.data.length > 0) {
            $.each(webcams.data, function (key, webcam) {
                $(`#webcam-${key} iframe`).attr('src', webcam.url);
                $(`#webcam-name-${key} p`).text(webcam.name);
                $(`#webcam-${key}`).removeClass('hide');
                $(`#webcam-name-${key}`).removeClass('hide');
            });
            $('#webcams-unavailable').addClass('hide');
        } else {
            // Webcams unavailable for this country
            $('#webcams-unavailable p').text(webcams.status.error);
        }

    };

    /* ============================================== */
    /* ADD THE COUNTRY INFORMATION BUTTONS TO THE MAP */
    /* ============================================== */
    L.easyButton('map-button map-help-button fas fa-question', function() {
        $('#helpModal').modal('show');
    }, 'How to use Gazetteer').addTo(gazetteerMap);

    // Add a 'START HERE' tooltip to the map help button - shown only once on initial app load
    $('.map-help-button').attr('data-toggle', 'tooltip');
    $('.map-help-button').attr('data-placement', 'right');
    $('.map-help-button').attr('data-offset', [0, 20]);
    $('.map-help-button').attr('title', 'START HERE');
    $('.map-help-button').tooltip('enable');

    L.easyButton('map-button fas fa-info', function() {
        $('#modal-card-general').modal('show');
    }, 'Show country information').addTo(gazetteerMap);

    L.easyButton('map-button fab fa-wikipedia-w', function() {
        $('#modal-card-wikipedia').modal('show');
    }, 'Show Wikipedia information').addTo(gazetteerMap);

    const weatherButton = L.easyButton('map-button fas fa-sun', function() {
        $('#modal-card-weather').modal('show');
    }, 'Show weather forecast', {position: 'topleft'}).addTo(gazetteerMap);

    const currencyButton = L.easyButton('map-button fas fa-dollar-sign', function() {
        $('#modal-card-currency').modal('show');
    }, 'Show currency converter', {position: 'topleft'}).addTo(gazetteerMap);

    const translateButton = L.easyButton('map-button far fa-comment', function() {
        $('#modal-card-translate').modal('show');
    }, 'Show language translation', {position: 'topleft'}).addTo(gazetteerMap);

    const holidaysButton = L.easyButton('map-button far fa-calendar-alt', function() {
        $('#modal-card-holidays').modal('show');
    }, 'Show public holidays', {position: 'topleft'}).addTo(gazetteerMap);

    const webcamsButton = L.easyButton('map-button fas fa-video', function() {
        $('#modal-card-webcams').modal('show');
    }, 'Show webcams', {position: 'topleft'}).addTo(gazetteerMap);

    const responsiveMapButtons = [weatherButton, currencyButton, translateButton, holidaysButton, webcamsButton];

    /* ============================================= */
    /* GET USER LOCATION */
    /* ============================================= */
    const locationSuccess = location => {
        // Successfully retrieved user's location
        const userLat = location.coords.latitude;
        const userLng = location.coords.longitude;
        // Fetch country data using lat/lng coordinates from user provided location data
        getAllGeoData({ lat:userLat, lng:userLng });
    };

    const locationError = error => {
        // Error fetching location or user denied location access
        // Default to UK instead
        getAllGeoData({ iso2:'GB', country:'United Kingdom' });
    };

    // Display the prompt to get user's current location
    navigator.geolocation.getCurrentPosition(locationSuccess, locationError);

    /* ============================================= */
    /* SET UP EVENT LISTENERS */
    /* ============================================= */

    // Reposition the map buttons along both edges of the map if the screen resizes
    // and its height can no longer accommodate all buttons in a single column
    $(window).resize(function() {
        if ($(window).height() < 550) {
            if (responsiveMapButtons[0].options.position !== 'topright') {
                $.each(responsiveMapButtons, function (key, button) {
                    button.options.position = 'topright';
                    button.addTo(gazetteerMap);
                });
            }
        } else {
            if (responsiveMapButtons[0].options.position !== 'topleft') {
                $.each(responsiveMapButtons, function (key, button) {
                    button.options.position = 'topleft';
                    button.addTo(gazetteerMap);
                });
            }
        }
    });

    // Add animation to the 'START HERE' tooltip after it is shown
    $('.map-help-button').on('shown.bs.tooltip', function() {
        $('.tooltip').addClass('tooltip-bounce-left');
    });

    // Permanently remove the 'START HERE' tooltip after the first interaction with the app
    $(document).add('.easy-button-button').on('touchstart mousedown', function() {
        $('.map-help-button').tooltip('hide');
        $('.map-help-button').removeAttr('data-toggle');
        $('.map-help-button').removeAttr('data-placement');
        $('.map-help-button').removeAttr('data-offset');
        $('.map-help-button').removeAttr('title');
        $('.map-help-button').tooltip('dispose');

        // Remove the document touch/mouse event handlers as they are no longer needed after the first touch/click
        $(document).add('.easy-button-button').off('touchstart mousedown');
    });

    /* Select country from dropdown */
    $('#countryDropdownList').change(function() {
        if ($('#countryDropdownList option:selected').val() !== 'default') {
            // Show the loading screen
            $('#preloader').fadeIn(500);        
            // Fetch country data using ISO2 code and country name
            getAllGeoData({ iso2:$('#countryDropdownList').val(), country:$('#countryDropdownList option:selected').text() });
        }
    });

    /* Change value of currency exchange input */
    $('#currencyAmountInput').on('input', function() {
        $('#currency-results').children().addClass('hide');
        checkCurrencyConversion();
    });

    /* Click currency 'Convert' button */
    $('#currency-convert-button').on('click', function() {
        // Only proceed if all the required inputs are available
        if ($('#currencyAmountInput').val() && $('#currencyFromDropdownList').val() && $('#currencyToDropdownList').val()) {

            // Get the inputs
            const exchangeFrom = $('#currencyFromDropdownList option:selected');
            const exchangeTo = $('#currencyToDropdownList option:selected');
            const exchangeAmount = $('#currencyAmountInput');

            $.ajax({
                type: 'GET',
                url: 'resources/php/getExchangeRates.php',
                data: {
                    'from': exchangeFrom.val(),
                    'to': exchangeTo.val(),
                    'amount': exchangeAmount.val()
                },
                dataType: 'json',
                success: function(exchange) {

                    if (exchange.status.result == "OK") {
                        if (exchange.data.exchangeResult) {

                            // Clear any previous conversions from the results fields
                            $('#currency-result-from-amount').text('');
                            $('#currency-result-from').html($('#currency-result-from-amount'));
                            $('#currency-result-to-amount').text('');
                            $('#currency-result-to').html($('#currency-result-to-amount'));

                            // Get the date/time the exchange rate was last updated
                            const exchangeRateTimestamp = getDateFromTimestamp(exchange.data.timestamp);

                            // Update the exchange conversion results
                            $('#currency-result-from-amount').text(`${formatNumber(roundNumber(exchangeAmount.val(), 5))} `);
                            $('#currency-result-from').html($('#currency-result-from').html() + `${$(exchangeFrom).attr('data-name')} = `);
                            $('#currency-result-to-amount').text(`${formatNumber(exchange.data.exchangeResult)} `);
                            $('#currency-result-to').html($('#currency-result-to').html() + `${$(exchangeTo).attr('data-name')}`);
                            $('#currency-base-rate').text(`1 ${exchangeFrom.val()} = ${formatNumber(exchange.data.exchangeRate)} ${exchangeTo.val()}`);
                            $('#currency-result-timestamp').text(`Last updated ${exchangeRateTimestamp[0]} ${exchangeRateTimestamp[1]}, ${exchangeRateTimestamp[2]} (UTC)`);

                            // Show the conversion results
                            $('#currency-results').children().removeClass('hide');
                        } else {
                            // Error calculating exchange rate conversion
                            $('#currency-result-from').text(`${$('#modal-card-currency .modal-title').text()} ${errorText}`);
                            $('#currency-results .row').first().add('#currency-result-from').removeClass('hide');
                        }
                    } else {
                        // Error returned from API
                        $('#currency-result-from').text(`${$('#modal-card-currency .modal-title').text()} ${errorText}`);
                        $('#currency-results .row').first().add('#currency-result-from').removeClass('hide');
                    }
                }
            });
        }
    });

    /* Enter translation text - character limit counter */
    $('#translateInputText').on('input', function() {
        $('#translate-char-limit').text(`${$('#translateInputText').val().length} / 500`);
        $('#translate-button').prop('disabled', $('#translateInputText').val().length === 0 ? true : false);
    });

    /* Click language 'Translate' button */
    $('#translate-button').on('click', function() {
        const langInputData = {
            'translateText': $('#translateInputText').val(),
            'translateToLang': $('#translateOutputDropdownList option:selected').val()
        };

        $.ajax({
            type: 'GET',
            url: 'resources/php/getTranslation.php',
            data: langInputData,
            dataType: 'json',
            success: function(translateData) {

                if (translateData.status.result == "OK") {
                    if ('translatedText' in translateData.data.responseData) {
                        $('#translateOutputText').val(htmlEntities(translateData.data.responseData.translatedText, 'unescape'));
                    }
                } else {
                    // Translation unavailable or language not supported
                    $('#translateOutputText').val(translateData.status.error);
                }
            }
        });
    });

    /* Click 'copy translated text' button */
    $('#translate-copy').on('click', function() {
        if ($('#translateOutputText').val().length > 0) {
            const clipboardText = document.getElementById('translateOutputText');
            clipboardText.select();
            clipboardText.setSelectionRange(0, 99999);
            document.execCommand('copy');
        }
        const copyTooltipText = $('#translateOutputText').val().length > 0 && !($('#translateOutputText').prop('disabled')) ? 'Copied to clipboard' : 'Nothing to copy';
        $('#translate-copy').attr({
            'data-toggle': 'tooltip',
            'data-animation': true,
            'data-placement': 'left',
            'data-offset': [0, 10],
            'data-trigger': 'manual',
            'data-original-title': copyTooltipText,
            'title': copyTooltipText
        });
        $('#translate-copy').tooltip('enable').tooltip('show');
    });

    /* Remove translation 'text copied' tooltip after timeout */
    $('#translate-copy').on('shown.bs.tooltip', function() {
        setTimeout(function() {
            $('#translate-copy').removeAttr('data-toggle data-animation data-placement data-offset data-trigger data-original-title title');
            $('#translate-copy').tooltip('hide').tooltip('disable');
        }, 2000);
    });

    /* Select currency from dropdowns */
    $('#currencyFromDropdownList, #currencyToDropdownList').change(function() {
        $('#currency-results').children().addClass('hide');
        checkCurrencyConversion();
    });

    /* Set image attribution text for map markers and Wikipedia image carousels */
    $("#marker-carousel").add("#wiki-carousel").on('slid.bs.carousel', function (e) {
        const element = $(e.relatedTarget).contents().filter(function() {
            // Get the 'element' node type
            return this.nodeType === 1;
        });
        if (e.currentTarget.id ==='marker-carousel') {
            $('#marker-photo-attribution').html(element[0]['dataset']['attribution']);
        } else if (e.currentTarget.id ==='wiki-carousel') {
            $('#modal-card-wiki-carousel-caption').html(element[0].children[0]['dataset']['caption'] + '<br>Attribution: ' + element[0].children[0]['dataset']['attribution']);
        }
    });

    /* ============================================= */
    /* UTILITY FUNCTIONS */
    /* ============================================= */

    /* HTML escape/unescape */
    const htmlEntities = (str, mode) => {
        if (mode === 'escape') {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        } else if (mode === 'unescape') {
            return String(str).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        }
    };

    /* Strip HTML tags */
    const stripHtmlTags = str => {
        return str.replace(/(<([^>]+)>)/gi, "");
    };

    /* Format long number - adds a comma as thousands separator */
    const formatNumber = num => {
        let str = num.toString().split(".");
        str[0] = str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return str.join(".");
    };

    /* Format date object as 'Day, DD Mmm YY' */
    const formatDate = dt => {
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const day = days[dt.getDay()];
        const date = dt.getDate().toString().length === 1 ? `0${dt.getDate()}` : dt.getDate();
        const month = months[dt.getMonth()];
        const year = dt.getFullYear().toString().substr(-2);
        return `${day}, ${date} ${month} ${year}`;
    };

    /* Round number to a given number of decimal places */
    const roundNumber = (num, places) => {
        return +(Math.round(num + "e+" + places)  + "e-" + places);
    };

    /* Get date from Unix timestamp - returns date, month and time */
    const getDateFromTimestamp = timestamp => {
        const dateObject = new Date(timestamp * 1000);
        return [
            dateObject.getDate(),
            dateObject.toLocaleString('en-GB', { month: 'long' }),
            `${(dateObject.getUTCHours()<10?'0':'') + dateObject.getUTCHours()}:${(dateObject.getMinutes()<10?'0':'') + dateObject.getMinutes()}`
        ];
    };

    /* Check currency conversion */
    /* Disable conversion button if inputs are not set */
    const checkCurrencyConversion = () => {
        // First clear any existing conversion data from the screen
        if (!$('#currencyAmountInput').val()
        || $('#currencyAmountInput').val() < 1
        || !$('#currencyFromDropdownList').val()
        || !$('#currencyToDropdownList').val()) {
            $('#currency-convert-button').prop('disabled', true);
        } else {
            $('#currency-convert-button').prop('disabled', false);
        }
    };

    /* Preload map marker images in carousel before marker modal is shown */
    const preloadMarkerImages = srcs => {
        let img;
        $.each(srcs, function (index, src) {
            img = new Image();
            img.onload = function() {
                if (index === srcs.length - 1) {
                    // Last image - remove the preloader and show the marker modal
                    removeLoadingScreen();
                    $('#markerModal').modal('show');
                }
            };
            img.src = src;
        });
    };

});