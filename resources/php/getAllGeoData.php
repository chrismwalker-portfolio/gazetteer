<?php

    $executionStartTime = microtime(true);

    /* ============================================= */
    /* OPENCAGE API */
    /* ============================================= */
    /* GET BASE COUNTRY DATA */
    /* ============================================= */

    // Include updated boundaries and keys
    require('gazetteerKeys.php');
    require('getUpdatedBounds.php');

    // Include OpenCage PHP libraries
    include('../../vendors/php/OpenCage/AbstractGeocoder.php');
    include('../../vendors/php/OpenCage/Geocoder.php');

    // Initialise geocoder
    $geocoder = new \OpenCage\Geocoder\Geocoder($openCageKey);

    if ($_REQUEST['iso2'] == 'false') {
        // No ISO2 passed in - use the lat/lng coordinates from the request instead
        $openCageCountry = $geocoder->geocode($_REQUEST['lat'].",".$_REQUEST['lng']);
        $iso2 = json_encode($openCageCountry["results"][0]["components"]["ISO_3166-1_alpha-2"]);
        $country = substr(json_encode($openCageCountry["results"][0]["components"]["country"]), 1, -1);
    } else {
        // ISO2 and country were passed in
        $iso2 = json_encode($_REQUEST['iso2']);
        $country = $_REQUEST['country'];
    }

    // Check if there are updated, improved boundaries for this country
    $bounds = getIso2Bounds(json_decode($iso2));

    // Initialise Open Cage variables
    $openCageResult = '';
    $openCageResults = '';

    // Fetch the Open Cage results
    $openCageResults = $geocoder->geocode($country,['countrycode'=> $iso2, 'no_annotations'=> 1]);

    // If results were returned from Open Cage
    if ($openCageResults && $openCageResults['total_results'] > 0) {

        // There can be additional results of varying types if there were other matches
        // containing the country's name within that country (e.g. a street, building, etc.).
        // So find the first result that is of type 'country'
        foreach ($openCageResults["results"] as $result) {
            if ($result["components"]["_type"] == "country" || $result["components"]["_type"] == "countyk") {
                $openCageResult = $result;
                break;
            }
        }

        // If there is still no result found, it could be due to missing or mislabelled properties
        // in the API data, so get the first result, if there is one
        if ($openCageResults["results"][0]) {
            $openCageResult = $openCageResults["results"][0];
        }
    }

    // Only proceed if a country has been found in the Open Cage results
    if ($openCageResult) {

        // Retrieve the lat/lng coordinates from the OpenCage result
        // These will be used for subsequent API calls
        $lat = json_encode($openCageResult["geometry"]["lat"]);
        $lng = json_encode($openCageResult["geometry"]["lng"]);

        // If the bounds were overridden above, update the Open Cage data,
        // as some Open Cage results are missing their 'bounds' property
        if ($bounds) {
            // Create an array from the bounds string
            $newBounds = explode(",", $bounds);

            $openCageResult["bounds"]["southwest"]["lng"] = floatval($newBounds[0]);
            $openCageResult["bounds"]["southwest"]["lat"] = floatval($newBounds[1]);
            $openCageResult["bounds"]["northeast"]["lng"] = floatval($newBounds[2]);
            $openCageResult["bounds"]["northeast"]["lat"] = floatval($newBounds[3]);
        }

        // Set the individual SW/NE coordinates for the boundaries
        $boundsWLng = json_encode($openCageResult["bounds"]["southwest"]["lng"]);
        $boundsSLat = json_encode($openCageResult["bounds"]["southwest"]["lat"]);
        $boundsELng = json_encode($openCageResult["bounds"]["northeast"]["lng"]);
        $boundsNLat = json_encode($openCageResult["bounds"]["northeast"]["lat"]);

        /* ============================================= */
        /* cURL INITIALISATION
        /* ============================================= */

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        /* ============================================= */
        /* HERE 'PLACES' API - POI MARKER LAYER FOR MAP */
        /* ============================================= */
        /* USE COUNTRY BOUNDARIES TO RESTRICT LOCATION */
        /* OF POI RESULTS RETURNED */
        /* MAXIMUM TOP 100 MOST POPULAR RESULTS RETURNED */
        /* ============================================= */

        // Set the POI marker boundaries from the Open Cage data
        $poiBounds = $boundsWLng.",".$boundsSLat.",".$boundsELng.",".$boundsNLat;

        $hereUrl = "https://places.ls.hereapi.com/places/v1/discover/explore?apiKey=".$hereKey."&in=".$poiBounds."&cat=sights-museums&size=100";
        curl_setopt($ch, CURLOPT_URL,$hereUrl);
        $hereResult = curl_exec($ch);
        $hereResult = json_decode($hereResult,true);

        /* ============================================= */
        /* REST COUNTRIES API - MAIN COUNTRY INFO */
        /* ============================================= */

        $restCountriesUrl = "https://restcountries.eu/rest/v2/alpha/".json_decode($iso2);
        curl_setopt($ch, CURLOPT_URL,$restCountriesUrl);
        $restCountriesResult = curl_exec($ch);
        $restCountriesResult = json_decode($restCountriesResult,true);

        /* ============================================= */
        /* WIKIPEDIA INFO - TEXT */
        /* ============================================= */

        $wikipediaTextUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/".str_replace(" ", "_", $country);
        curl_setopt($ch, CURLOPT_URL,$wikipediaTextUrl);
        $wikipediaTextUrlResult = curl_exec($ch);
        $wikipediaTextUrlResult = json_decode($wikipediaTextUrlResult,true);

        /* ============================================= */
        /* WIKIPEDIA INFO - IMAGES */
        /* ============================================= */

        // Scale all thumbnails to 200px height
        $wikipediaImagesUrl = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlheight=200&generator=images&pageids=".$wikipediaTextUrlResult["pageid"];
        curl_setopt($ch, CURLOPT_URL,$wikipediaImagesUrl);
        $wikipediaImagesUrlResult = curl_exec($ch);
        $wikipediaImagesUrlResult = json_decode($wikipediaImagesUrlResult,true);

        /* ============================================= */
        /* OPENWEATHER FORECAST */
        /* ============================================= */

        $openWeatherUrl = "https://api.openweathermap.org/data/2.5/onecall?lat=".$lat."&lon=".$lng."&exclude=current,minutely,hourly,alerts&units=metric&appid=".$openWeatherKey;
        curl_setopt($ch, CURLOPT_URL,$openWeatherUrl);
        $openWeatherResult = curl_exec($ch);
        $openWeatherResult = json_decode($openWeatherResult,true);

        /* ============================================= */
        /* PUBLIC HOLIDAYS */
        /* ============================================= */

        $holidaysUrl = "https://date.nager.at/api/v3/publicholidays/".date("Y")."/".json_decode($iso2);
        curl_setopt($ch, CURLOPT_URL,$holidaysUrl);
        $holidaysResult = curl_exec($ch);
        $holidaysResult = json_decode($holidaysResult,true);

        /* ============================================= */
        /* WEBCAMS */
        /* ============================================= */

        $webcamUrl = "https://api.windy.com/api/webcams/v2/list/country=".json_decode($iso2)."/orderby=popularity/limit=3?show=webcams:player&key=".$windyKey;
        curl_setopt($ch, CURLOPT_URL,$webcamUrl);
        $webcamData = curl_exec($ch);
        $webcamData = json_decode($webcamData,true);

        if (count($webcamData["result"]["webcams"]) < 1) {
            $webcamResult['status']['code'] = "404";
            $webcamResult['status']['result'] = "ERROR";
            $webcamResult['status']['description'] = "error";
            $webcamResult['status']['error'] = "Webcams are unavailable for this country";
        } else {
            $webcamResult['status']['code'] = "200";
            $webcamResult['status']['result'] = "OK";
            $webcamResult['status']['description'] = "success";

            $webcams = [];

            foreach ($webcamData['result']['webcams'] as $webcam) {
                $temp = null;
                $temp['name'] = $webcam['title'];
                $temp['url'] = $webcam['player']['day']['embed'];

                array_push($webcams, $temp);
            }
        }

        if (isset($webcams)) {
            $webcamResult['data'] = $webcams;
        }

        // Close the cURL session
        curl_close($ch);

    }

    /* ============================================= */
    /* CREATE THE OUTPUT */
    /* ============================================= */

    if (!$openCageResult) {
        $output['status']['code'] = "400";
        $output['status']['result'] = "ERROR";
        if ($openCageResults) {
            $output['openCage'] = $openCageResults;
        }
    } else {
        $output['status']['code'] = "200";
        $output['status']['result'] = "OK";
        $output['openCage'] = $openCageResult;
        $output['here'] = $hereResult;
        $output['restCountries'] = $restCountriesResult;
        $output['wikipediaText'] = $wikipediaTextUrlResult;
        $output['wikipediaImages'] = $wikipediaImagesUrlResult;
        $output['openWeather'] = $openWeatherResult;
        $output['holidays'] = $holidaysResult;
        $output['webcams'] = $webcamResult;
    }

    $output['status']['returnedIn'] = (microtime(true) - $executionStartTime) / 1000000 . " ms";

	header('Content-Type: application/json; charset=UTF-8');

    /* ============================================= */
    /* RETURN THE FULL OUTPUT AS JSON */
    /* ============================================= */
	echo json_encode($output);

?>