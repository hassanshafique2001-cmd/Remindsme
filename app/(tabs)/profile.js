import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../utils/firebase";
import { useTheme, useThemePreference } from "../../utils/theme";
import {
  authenticateWithBiometrics,
  isAppLockEnabled,
  isDeviceLockAvailable,
  setAppLockEnabled,
} from "../../utils/appLock";
import { getDefaultViewMode, setDefaultViewMode } from "../../utils/viewPreference";
import { exportBackup, importBackup } from "../../utils/backup";

function mapAuthError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

// Yeh device-level setting hai (login se juda nahi) - local guest data ho ya
// cloud account, dono mein financial info hoti hai, isliye AuthForm aur
// SignedInView dono mein render hoti hai. Web par ya jab device par koi
// Face ID/fingerprint/PIN set up hi nahi, to kuch bhi nahi dikhata.
function SecuritySection({ theme, styles }) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const [avail, on] = await Promise.all([isDeviceLockAvailable(), isAppLockEnabled()]);
      setAvailable(avail);
      setEnabled(on);
      setLoading(false);
    })();
  }, []);

  async function handleToggle(value) {
    // Feature ON karne se pehle identity confirm karwa lete hain, taake koi
    // aur (jinke paas phone unlocked mil jaye) khud apni Face ID enroll
    // karke feature ko chupke se on/off na kar sake.
    if (value) {
      const success = await authenticateWithBiometrics();
      if (!success) return;
    }
    await setAppLockEnabled(value);
    setEnabled(value);
  }

  if (Platform.OS === "web" || loading || !available) return null;

  return (
    <View style={styles.securityBox}>
      <View style={styles.infoRow}>
        <View style={styles.infoIconBadge}>
          <Ionicons name="finger-print-outline" size={18} color={theme.primary} />
        </View>
        <View style={styles.infoTextGroup}>
          <Text style={styles.infoLabel}>App Lock</Text>
          <Text style={styles.securitySubtext}>Require Face ID or fingerprint to open the app</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ true: theme.primary }}
        />
      </View>
    </View>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "auto", label: "Auto", icon: "phone-portrait-outline" },
];

// Yeh bhi device-level setting hai (SecuritySection jesi) - login se pehle
// aur baad dono jagah dikhti hai. "Auto" system ke dark/light mode ko follow
// karta hai; Light/Dark manually override karte hain.
function ThemeSection({ theme, styles }) {
  const { preference, setPreference } = useThemePreference();

  return (
    <View style={styles.securityBox}>
      <Text style={styles.infoLabel}>Appearance</Text>
      <View style={styles.themeRow}>
        {THEME_OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.themeOption, active && styles.themeOptionActive]}
              onPress={() => setPreference(opt.value)}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={active ? "#fff" : theme.text}
              />
              <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const VIEW_MODE_OPTIONS = [
  { value: "list", label: "Payment Cards", icon: "list-outline" },
  { value: "calendar", label: "Calendar", icon: "calendar-outline" },
];

// Payments tab default mein "Payment Cards" (list) ya "Calendar" dikhaye -
// yeh bhi device-level setting hai (SecuritySection/ThemeSection jesi).
// Default hamesha "list" hai; user yahan se apni pasand chun sakta hai.
function PaymentsViewSection({ theme, styles }) {
  const [mode, setMode] = useState("list");

  useEffect(() => {
    getDefaultViewMode().then(setMode);
  }, []);

  async function handleSelect(value) {
    setMode(value);
    await setDefaultViewMode(value);
  }

  return (
    <View style={styles.securityBox}>
      <Text style={styles.infoLabel}>Payments Default View</Text>
      <View style={styles.themeRow}>
        {VIEW_MODE_OPTIONS.map((opt) => {
          const active = mode === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.themeOption, active && styles.themeOptionActive]}
              onPress={() => handleSelect(opt.value)}
            >
              <Ionicons name={opt.icon} size={18} color={active ? "#fff" : theme.text} />
              <Text style={[styles.themeOptionText, active && styles.themeOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Sirf guest (logged-out) users ke liye - cloud account waale users ka data
// pehle se hi Firestore mein mehfooz hota hai. Guest ka data sirf isi phone
// ke AsyncStorage mein hota hai, isliye ek JSON file export/import se woh
// naye device par ya reinstall ke baad apna data wapas la sakte hain.
function BackupSection({ theme, styles }) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      await exportBackup();
    } catch (e) {
      Alert.alert("Backup Failed", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    try {
      const count = await importBackup();
      Alert.alert(
        count > 0 ? "Backup Restored" : "Nothing to Restore",
        count > 0 ? `${count} payment${count === 1 ? "" : "s"} restored.` : "No payments were found in that file."
      );
    } catch (e) {
      Alert.alert("Restore Failed", e.message);
    } finally {
      setBusy(false);
    }
  }

  if (Platform.OS === "web") return null;

  return (
    <View style={styles.securityBox}>
      <Text style={styles.infoLabel}>Local Backup</Text>
      <Text style={styles.securitySubtext}>
        Save your payments to a file, or restore them from a previous backup.
      </Text>
      <View style={styles.backupButtonRow}>
        <TouchableOpacity style={styles.backupButton} onPress={handleExport} disabled={busy}>
          <Ionicons name="download-outline" size={18} color={theme.primary} />
          <Text style={styles.backupButtonText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backupButton} onPress={handleImport} disabled={busy}>
          <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />
          <Text style={styles.backupButtonText}>Import</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AuthForm({ theme, styles }) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState("signIn");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "signUp") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return;
      }
      if (!phone.trim()) {
        setError("Please enter your phone number.");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "signUp") {
        await signUp(email.trim(), password, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        });
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      setError(mapAuthError(e.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={40} color={theme.primary} />
        </View>
        <Text style={styles.title}>
          {mode === "signIn" ? "Welcome back" : "Create your account"}
        </Text>
        <Text style={styles.subtitle}>
          {mode === "signIn"
            ? "Sign in to sync your payments across devices."
            : "Sign up to save your payments to the cloud."}
        </Text>

        {mode === "signUp" && (
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                placeholderTextColor={theme.textMuted}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Doe"
                placeholderTextColor={theme.textMuted}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 6 characters"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {mode === "signUp" && (
          <>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 234 567 8900"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === "signIn" ? "Sign In" : "Sign Up"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setError("");
            setMode(mode === "signIn" ? "signUp" : "signIn");
          }}
        >
          <Text style={styles.switchModeText}>
            {mode === "signIn"
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>

        <SecuritySection theme={theme} styles={styles} />
        <ThemeSection theme={theme} styles={styles} />
        <PaymentsViewSection theme={theme} styles={styles} />
        <BackupSection theme={theme} styles={styles} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SignedInView({ user, theme, styles }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let isActive = true;
    (async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (isActive && snap.exists()) {
        setProfile(snap.data());
      }
    })();
    return () => {
      isActive = false;
    };
  }, [user.uid]);

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }

  const fullName =
    profile?.firstName || profile?.lastName
      ? `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={theme.primary} />
        </View>
        <Text style={styles.fullName}>{fullName ?? user.email}</Text>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBadge}>
              <Ionicons name="mail-outline" size={18} color={theme.primary} />
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Your Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconBadge}>
              <Ionicons name="call-outline" size={18} color={theme.primary} />
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoLabel}>Your Phone Number</Text>
              <Text style={styles.infoValue}>{profile?.phone ?? "Not provided"}</Text>
            </View>
          </View>
        </View>

        <SecuritySection theme={theme} styles={styles} />
        <ThemeSection theme={theme} styles={styles} />
        <PaymentsViewSection theme={theme} styles={styles} />
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return user ? (
    <SignedInView user={user} theme={theme} styles={styles} />
  ) : (
    <AuthForm theme={theme} styles={styles} />
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 24,
      justifyContent: "space-between",
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
    },
    formScroll: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    profileCard: {
      alignItems: "center",
      marginTop: 40,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 8,
      textAlign: "center",
    },
    fullName: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 24,
      textAlign: "center",
    },
    infoBox: {
      width: "100%",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 18,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "dark" ? 0.3 : 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    securityBox: {
      width: "100%",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 18,
      marginTop: 16,
    },
    securitySubtext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    themeRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    themeOption: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
    },
    themeOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    themeOptionText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.text,
    },
    themeOptionTextActive: {
      color: "#fff",
    },
    backupButtonRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    backupButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    backupButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primary,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    infoIconBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    infoTextGroup: {
      flex: 1,
    },
    infoDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 16,
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
      marginTop: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: "center",
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    label: {
      alignSelf: "flex-start",
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 6,
      marginTop: 12,
    },
    nameRow: {
      flexDirection: "row",
      width: "100%",
      gap: 12,
    },
    nameField: {
      flex: 1,
    },
    input: {
      width: "100%",
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: theme.text,
    },
    error: {
      color: theme.danger,
      fontSize: 13,
      marginTop: 12,
      textAlign: "center",
    },
    submitButton: {
      width: "100%",
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 24,
      marginBottom: 16,
    },
    submitButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    switchModeText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    signOutButton: {
      width: "100%",
      borderWidth: 1.5,
      borderColor: theme.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 24,
    },
    signOutButtonText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "700",
    },
  });
}
