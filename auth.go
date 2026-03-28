package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var (
	oauthConfig   *oauth2.Config
	jwtSecretKey  []byte
	appURL        string
	allowedDomain string
	allowedEmails map[string]bool
)

type UserClaims struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
	jwt.RegisteredClaims
}

func initAuth() {
	jwtSecretKey = []byte(os.Getenv("JWT_SECRET"))
	if len(jwtSecretKey) == 0 {
		log.Fatal("JWT_SECRET environment variable not set")
	}

	appURL = os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:8080"
	}
	appURL = strings.TrimRight(appURL, "/")

	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		log.Fatal("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set")
	}

	oauthConfig = &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  appURL + "/auth/google/callback",
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}

	// Optional access restrictions.
	// ALLOWED_DOMAIN: only emails from this domain (e.g. "yourcompany.com")
	// ALLOWED_EMAILS: comma-separated list (e.g. "alice@gmail.com,bob@gmail.com")
	// If neither is set, any Google account is allowed.
	allowedDomain = os.Getenv("ALLOWED_DOMAIN")
	allowedEmails = make(map[string]bool)
	if raw := os.Getenv("ALLOWED_EMAILS"); raw != "" {
		for _, e := range strings.Split(raw, ",") {
			if trimmed := strings.TrimSpace(strings.ToLower(e)); trimmed != "" {
				allowedEmails[trimmed] = true
			}
		}
	}

	if allowedDomain != "" {
		log.Printf("Auth: restricting to domain @%s", allowedDomain)
	} else if len(allowedEmails) > 0 {
		log.Printf("Auth: restricting to %d allowlisted email(s)", len(allowedEmails))
	} else {
		log.Printf("Auth: open access — any Google account may sign in")
	}
}

func isEmailAllowed(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if allowedDomain != "" {
		return strings.HasSuffix(email, "@"+strings.ToLower(allowedDomain))
	}
	if len(allowedEmails) > 0 {
		return allowedEmails[email]
	}
	return true // no restriction set
}

func isHTTPS() bool {
	return strings.HasPrefix(appURL, "https://")
}

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

func handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	state, err := generateState()
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   isHTTPS(),
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, oauthConfig.AuthCodeURL(state), http.StatusTemporaryRedirect)
}

func handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", MaxAge: -1})

	token, err := oauthConfig.Exchange(context.Background(), r.URL.Query().Get("code"))
	if err != nil {
		log.Printf("token exchange failed: %v", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	client := oauthConfig.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		http.Error(w, "failed to get user info", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var userInfo struct {
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		http.Error(w, "failed to decode user info", http.StatusInternalServerError)
		return
	}

	if !isEmailAllowed(userInfo.Email) {
		log.Printf("Auth: access denied for %s", userInfo.Email)
		http.Error(w, "access denied: your account is not authorized to use this app", http.StatusForbidden)
		return
	}

	claims := UserClaims{
		Email:   userInfo.Email,
		Name:    userInfo.Name,
		Picture: userInfo.Picture,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := jwtToken.SignedString(jwtSecretKey)
	if err != nil {
		http.Error(w, "session creation failed", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    tokenString,
		Path:     "/",
		MaxAge:   86400,
		HttpOnly: true,
		Secure:   isHTTPS(),
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "session_token", Value: "", Path: "/", MaxAge: -1})
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := getUserFromRequest(r)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"unauthorized"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"email":   claims.Email,
		"name":    claims.Name,
		"picture": claims.Picture,
	})
}

func getUserFromRequest(r *http.Request) (*UserClaims, bool) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		return nil, false
	}
	token, err := jwt.ParseWithClaims(cookie.Value, &UserClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return jwtSecretKey, nil
	})
	if err != nil || !token.Valid {
		return nil, false
	}
	claims, ok := token.Claims.(*UserClaims)
	return claims, ok
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		if _, ok := getUserFromRequest(r); !ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}
