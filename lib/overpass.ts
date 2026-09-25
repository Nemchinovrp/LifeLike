export function nearbyQuery(lat: number, lon: number, radius: number) {
  const around = `(around:${radius},${lat},${lon})`;
  // Keep park boundary node IDs and relation members so entrances are matched
  // by topology, never merely by proximity to a park or building.
  return `[out:json][timeout:25];
 nwr[leisure~"^(park|garden)$"]${around}->.parks;
 (nwr[shop~"^(supermarket|convenience|grocery|outpost)$"]${around};
 nwr[amenity~"^(school|pharmacy|clinic|kindergarten|parcel_locker)$"]${around};
 nwr[healthcare~"^(clinic|pharmacy)$"]${around};
 nwr[leisure~"^(pitch|fitness_station)$"]${around};
 nwr["post_office:parcel_pickup"="yes"]${around};
 nwr[highway=bus_stop]${around};nwr[public_transport=platform]${around};
 nwr[railway~"^(station|halt)$"]${around};)->.pois;
 (.parks; .parks >>;)->.parkGeometry;
 (.pois;.parkGeometry;);out body center;`;
}
