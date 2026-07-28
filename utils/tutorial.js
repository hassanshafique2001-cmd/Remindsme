import AsyncStorage from "@react-native-async-storage/async-storage";

const TUTORIAL_KEY = "hasSeenAppTutorial";

// App pehli dafa khulne par 4-step tab walkthrough dikhata hai - is key se
// pata chalta hai ke user pehle hi dekh chuka hai ya "Skip" kar chuka hai,
// dono cases mein dobara nahi dikhana.
export async function hasSeenTutorial() {
  const value = await AsyncStorage.getItem(TUTORIAL_KEY);
  return value === "true";
}

export async function markTutorialSeen() {
  await AsyncStorage.setItem(TUTORIAL_KEY, "true");
}
