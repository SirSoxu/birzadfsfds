import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider } from "./lib/auth";
import { ChatThreadPage, ChatsPage } from "./pages/ChatsPage";
import { CreatePage } from "./pages/CreatePage";
import { DealsPage } from "./pages/DealsPage";
import { HomePage } from "./pages/HomePage";
import { ModerationPage } from "./pages/ModerationPage";
import { OfferPage } from "./pages/OfferPage";
import { OwnerPage } from "./pages/OwnerPage";
import { PlansPage } from "./pages/PlansPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SearchPage } from "./pages/SearchPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { UserPage, ReviewsPage } from "./pages/UserPage";
import { WalletPage } from "./pages/WalletPage";

export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/offer/:id" element={<OfferPage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/user/:id" element={<UserPage />} />
            <Route path="/user/:id/reviews" element={<ReviewsPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/chats/:id" element={<ChatThreadPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/moderation" element={<ModerationPage />} />
            <Route path="/owner" element={<OwnerPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
