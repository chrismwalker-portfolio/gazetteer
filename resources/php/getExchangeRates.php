<?php

	$executionStartTime = microtime(true);

    /* ============================================= */
    /* CURRENCY EXCHANGE RATE DATA */
    /* ============================================= */
    /* Fetch the latest exchange rates and return */
    /* currency exchange calculation */
    /* ============================================= */

    // Include keys
    require('gazetteerKeys.php');

	// Get request parameters
    $fromCurrency = $_REQUEST['from'];
    $toCurrency = $_REQUEST['to'];
    $exchangeAmount = $_REQUEST['amount'];

	$url = 'https://openexchangerates.org/api/latest.json?app_id='.$openExchangeRatesKey;

	$ch = curl_init();
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_URL,$url);

	$result = curl_exec($ch);

	curl_close($ch);

	$exchangeRatesData = json_decode($result,true);

	// Calculate the latest rate for exchanging between the two currencies
	$exchangeRate = floatval($exchangeRatesData["rates"][$toCurrency]) / floatval($exchangeRatesData["rates"][$fromCurrency]);

	// Calculate the exchange amount
	$exchangeResult = $exchangeAmount * $exchangeRate;

	$output['status']['code'] = "200";
	$output['status']['result'] = "OK";
	$output['status']['description'] = "success";
	$output['status']['returnedIn'] = intval((microtime(true) - $executionStartTime) * 1000) . " ms";
	$output['data']['exchangeRate'] = round($exchangeRate, 5);
	$output['data']['exchangeResult'] = round($exchangeResult, 5);
	$output['data']['timestamp'] = $exchangeRatesData['timestamp'];

	header('Content-Type: application/json; charset=UTF-8');

	echo json_encode($output); 

?>