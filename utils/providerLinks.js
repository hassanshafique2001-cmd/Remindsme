// Har provider (utils/providers.js ki list se) ka official website + (jahan
// bharosemand tareeqe se maloom ho) uska custom app URL scheme. Add Payment
// screen par provider select karte hi yahan se link khud-ba-khud jud jata hai
// - user ko manually koi link type nahi karni padti.
//
// "appScheme" sirf un chand consumer apps ke liye di hai jinke scheme well
// known hain (Netflix, Spotify, wagera). Baaki (khaas kar banks/insurance)
// ke liye sirf "webUrl" di hai - agar us company ki app phone par installed
// ho aur Universal Links support karti ho (jaisa aksar bare apps karte hain)
// to https link khud app khol dega, warna normal website khul jayegi.
// "Private Landlord" jaisi entries ka koi official app/website nahi hota,
// is liye unhe list mein shamil nahi kiya - button khud-ba-khud nahi dikhega.
export const PROVIDER_LINKS = {
  // Rent
  "Zillow Rental Manager": { webUrl: "https://www.zillow.com/rental-manager/", appScheme: "zillow://" },
  "Apartments.com": { webUrl: "https://www.apartments.com/" },
  "RentCafe": { webUrl: "https://www.rentcafe.com/" },
  "AppFolio": { webUrl: "https://www.appfolio.com/" },
  "Buildium": { webUrl: "https://www.buildium.com/" },

  // Car
  "Toyota Financial Services": { webUrl: "https://www.toyotafinancial.com/" },
  "Ally Financial": { webUrl: "https://www.ally.com/" },
  "Capital One Auto Finance": { webUrl: "https://www.capitalone.com/cars/auto-loans/" },
  "Chase Auto": { webUrl: "https://www.chase.com/personal/auto" },
  "Honda Financial Services": { webUrl: "https://www.hondafinancialservices.com/" },
  "Ford Credit": { webUrl: "https://www.ford.com/finance/" },
  "GM Financial": { webUrl: "https://www.gmfinancial.com/" },
  "Wells Fargo Auto": { webUrl: "https://www.wellsfargo.com/auto/" },

  // Insurance
  "Geico": { webUrl: "https://www.geico.com/" },
  "Progressive": { webUrl: "https://www.progressive.com/" },
  "State Farm": { webUrl: "https://www.statefarm.com/" },
  "Allstate": { webUrl: "https://www.allstate.com/" },
  "Liberty Mutual": { webUrl: "https://www.libertymutual.com/" },
  "USAA": { webUrl: "https://www.usaa.com/" },
  "Farmers": { webUrl: "https://www.farmers.com/" },
  "Nationwide": { webUrl: "https://www.nationwide.com/" },

  // Subscription
  "Netflix": { webUrl: "https://www.netflix.com/", appScheme: "nflx://" },
  "Spotify": { webUrl: "https://www.spotify.com/", appScheme: "spotify://" },
  "Disney+": { webUrl: "https://www.disneyplus.com/" },
  "Amazon Prime": { webUrl: "https://www.amazon.com/prime" },
  "Hulu": { webUrl: "https://www.hulu.com/", appScheme: "hulu://" },
  "HBO Max": { webUrl: "https://www.max.com/" },
  "YouTube Premium": { webUrl: "https://www.youtube.com/premium", appScheme: "youtube://" },
  "Apple Music": { webUrl: "https://music.apple.com/", appScheme: "music://" },
  "Apple TV+": { webUrl: "https://tv.apple.com/", appScheme: "videos://" },

  // Bills (gas/electric utilities)
  "National Grid": { webUrl: "https://www.nationalgridus.com/" },
  "Eversource": { webUrl: "https://www.eversource.com/" },
  "Liberty Utilities": { webUrl: "https://www.libertyutilities.com/" },
  "Duke Energy": { webUrl: "https://www.duke-energy.com/" },
  "Con Edison": { webUrl: "https://www.coned.com/" },
  "PG&E": { webUrl: "https://www.pge.com/" },
  "Southern California Edison": { webUrl: "https://www.sce.com/" },
  "Xcel Energy": { webUrl: "https://www.xcelenergy.com/" },
  "Dominion Energy": { webUrl: "https://www.dominionenergy.com/" },
  "PSE&G": { webUrl: "https://www.pseg.com/" },
  "American Electric Power": { webUrl: "https://www.aep.com/" },
  "Georgia Power": { webUrl: "https://www.georgiapower.com/" },
  "Florida Power & Light": { webUrl: "https://www.fpl.com/" },
  "CenterPoint Energy": { webUrl: "https://www.centerpointenergy.com/" },
  "Ameren": { webUrl: "https://www.ameren.com/" },
  "We Energies": { webUrl: "https://www.we-energies.com/" },
  "Puget Sound Energy": { webUrl: "https://www.pse.com/" },
  "Atmos Energy": { webUrl: "https://www.atmosenergy.com/" },
  "Southwest Gas": { webUrl: "https://www.swgas.com/" },
};

export function getProviderLink(providerName) {
  return PROVIDER_LINKS[providerName] ?? null;
}
