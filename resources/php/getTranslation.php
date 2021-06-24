<?php

	$executionStartTime = microtime(true);

    /* ================================================ */
    /* LANGUAGE TRANSLATION */
    /* ================================================ */
    /* Translates up to 500 characters of text from */
    /* English into another language using MyMemory API */
    /* ================================================ */

    // Include keys
    require('gazetteerKeys.php');

	// Get values from request
	$translateText = $_REQUEST['translateText'];
	$langPair = 'en|'.$_REQUEST['translateToLang'];

	$url = 'https://api.mymemory.translated.net/get?q='.urlencode($translateText).'&langpair='.$langPair.'&de='.$myMemoryKey;

	$ch = curl_init();
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_URL,$url);

	$result = curl_exec($ch);

	curl_close($ch);

	$translationData = json_decode($result,true);

	if ($translationData["responseStatus"] != "200" || !($translationData["responseData"]["translatedText"])) {
		$output['status']['code'] = $translationData["responseStatus"];
		$output['status']['result'] = "ERROR";
		$output['status']['description'] = "error";
		$output['status']['error'] = "Translation unavailable or language not supported.";
	} else {
		$output['status']['code'] = "200";
		$output['status']['result'] = "OK";
		$output['status']['description'] = "success";	
	}
	$output['status']['returnedIn'] = intval((microtime(true) - $executionStartTime) * 1000) . " ms";
	$output['data'] = $translationData;

	header('Content-Type: application/json; charset=UTF-8');

	echo json_encode($output); 

?>