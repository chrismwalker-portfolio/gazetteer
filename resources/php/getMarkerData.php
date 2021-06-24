<?php

	$executionStartTime = microtime(true);

    /* ============================================= */
    /* HERE MARKER DATA */
    /* ============================================= */
    /* Fetch additional data for a marker using the */
    /* URL provided in the initial HERE POI result */
    /* ============================================= */

	$url = $_REQUEST['hereMarkerUrl'];

	$ch = curl_init();
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_URL,$url);

	$result = curl_exec($ch);

	curl_close($ch);

	$hereMarkerData = json_decode($result,true);

	$output['status']['code'] = "200";
	$output['status']['result'] = "OK";
	$output['status']['description'] = "success";
	$output['status']['returnedIn'] = intval((microtime(true) - $executionStartTime) * 1000) . " ms";
	$output['data'] = $hereMarkerData;
	
	header('Content-Type: application/json; charset=UTF-8');

	echo json_encode($output); 

?>
