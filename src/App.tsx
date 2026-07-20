import { HashRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "./context/DataContext";
import { AuthProvider } from "./context/AuthContext";
import { UserAuthProvider } from "./context/UserAuthContext";
import { NodbetProvider } from "./context/NodbetContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SideBanners from "./components/SideBanners";
import EmailConfirmOverlay from "./components/EmailConfirmOverlay";
import Home from "./pages/Home";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Bracket from "./pages/Bracket";
import Matches from "./pages/Matches";
import MatchDetail from "./pages/MatchDetail";
import Leaderboard from "./pages/Leaderboard";
import AdminPage from "./pages/admin/AdminPage";
import NodbetPage from "./pages/NodbetPage";
import ResetPassword from "./pages/ResetPassword";

function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white antialiased">
      <Navbar />
      <SideBanners />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UserAuthProvider>
        <DataProvider>
          <NodbetProvider>
            <EmailConfirmOverlay />
            <HashRouter>
              <Routes>
                <Route path="/" element={<SiteLayout><Home /></SiteLayout>} />
                <Route path="/nodbet" element={<SiteLayout><NodbetPage /></SiteLayout>} />
                <Route path="/teams" element={<SiteLayout><Teams /></SiteLayout>} />
                <Route path="/teams/:id" element={<SiteLayout><TeamDetail /></SiteLayout>} />
                <Route path="/bracket" element={<SiteLayout><Bracket /></SiteLayout>} />
                <Route path="/matches" element={<SiteLayout><Matches /></SiteLayout>} />
                <Route path="/matches/:id" element={<SiteLayout><MatchDetail /></SiteLayout>} />
                <Route path="/leaderboard" element={<SiteLayout><Leaderboard /></SiteLayout>} />
                <Route path="/reset-password" element={<SiteLayout><ResetPassword /></SiteLayout>} />
                <Route
                  path="/nb-admin-9991"
                  element={
                    <div className="min-h-screen bg-[#0d0d0d] text-white antialiased">
                      <AdminPage />
                    </div>
                  }
                />
                <Route path="*" element={<SiteLayout><Home /></SiteLayout>} />
              </Routes>
            </HashRouter>
          </NodbetProvider>
        </DataProvider>
      </UserAuthProvider>
    </AuthProvider>
  );
}
