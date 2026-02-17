import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { driverPos, bins } = await req.json();

    if (!driverPos || !bins || bins.length === 0) {
      return NextResponse.json({ error: "Missing driver position or bins" }, { status: 400 });
    }

    // 1. Sanitize & Format Coordinates
    // Mapbox needs: lng,lat;lng,lat;lng,lat
    const driverCoord = `${driverPos[1]},${driverPos[0]}`; // longitude,latitude
    const binCoords = bins
      .slice(0, 11)
      .map((b: any) => `${b.lng},${b.lat}`)
      .join(";");

    const fullCoordsString = `${driverCoord};${binCoords}`;

    // DEBUG: Check your terminal (not browser) to see the coordinates being sent
    console.log("AI DATA - Coordinates String:", fullCoordsString);

    // 2. Build URL
    const baseUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${fullCoordsString}`;
    const params = new URLSearchParams({
      source: "first",
      destination: "any",
      roundtrip: "false",
      geometries: "polyline",
      overview: "full",
      access_token: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "",
    });

    const finalUrl = `${baseUrl}?${params.toString()}`;
    
    const response = await fetch(finalUrl);
    const data = await response.json();

    // 3. Handle Failures
    if (data.code !== "Ok") {
      console.error("Mapbox AI Error Details:", data); // Detailed log for debugging
      
      if (data.code === "NotImplemented") {
        return NextResponse.json({ 
          error: "No road connection found. Check coordinate order (Lng,Lat).",
          code: "NO_ROAD",
          debug: fullCoordsString 
        }, { status: 422 });
      }
      
      throw new Error(data.message || "AI Optimization Failed");
    }

    return NextResponse.json({
      optimizedOrder: data.waypoints,
      geometry: data.trips[0].geometry,
      distance: data.trips[0].distance,
      duration: data.trips[0].duration
    });

  } catch (error: any) {
    console.error("Server-side Route Handler Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}