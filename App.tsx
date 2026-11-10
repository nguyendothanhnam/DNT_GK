import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError, Session, User, UserInput } from './src/api';

const empty: UserInput = { email: '', matkhau: '', hoten: '', hinhanh: '' };
const C = { ink: '#162c2b', muted: '#687b77', green: '#16715d', line: '#dce5df', bg: '#f4f7f3', red: '#b83e3e' };
function Button({ title, onPress, secondary = false, danger = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, danger && { backgroundColor: C.red }, { opacity: disabled ? .5 : pressed ? .75 : 1 }]}><Text style={[s.buttonText, secondary && { color: C.ink }]}>{title}</Text></Pressable>;
}
function Avatar({ user, large = false }: { user: User; large?: boolean }) {
  const size = large ? 90 : 46;
  return user.hinhanh ? <Image accessibilityLabel={`Ảnh ${user.hoten}`} source={{ uri: user.hinhanh }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e1ebe5' }} /> : <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}><Text style={{ color: C.green, fontWeight: '700', fontSize: large ? 30 : 18 }}>{user.hoten.trim().split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase() || 'U'}</Text></View>;
}
function Field({ label, value, onChangeText, password = false, email = false, editable = true, hint }: { label: string; value: string; onChangeText: (value: string) => void; password?: boolean; email?: boolean; editable?: boolean; hint?: string }) {
  const [show, setShow] = useState(false);
  return <View style={{ gap: 7 }}><Text style={s.label}>{label}</Text><View style={[s.inputWrap, !editable && { backgroundColor: '#edf1ec' }]}><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={editable} secureTextEntry={password && !show} autoComplete={password ? 'new-password' : 'off'} textContentType="none" importantForAutofill="no" autoCapitalize={email || password ? 'none' : 'words'} autoCorrect={false} keyboardType={email ? 'email-address' : 'default'} style={s.input} placeholder={email ? 'ban@example.com' : password ? 'Nhập mật khẩu' : 'Nhập họ và tên'} placeholderTextColor="#8b9891" />{password && <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShow(!show)} style={{ padding: 10 }}><Text style={s.link}>{show ? 'Ẩn' : 'Hiện'}</Text></Pressable>}</View>{hint && <Text style={s.hint}>{hint}</Text>}</View>;
}
export default function App() {
  return <SafeAreaProvider><UserManagement /></SafeAreaProvider>;
}
function UserManagement() {
  const { width } = useWindowDimensions(); const wide = width >= 850;
  const [session, setSession] = useState<Session | null>(null);
  const [login, setLogin] = useState({ email: '', matkhau: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<UserInput | null>(null), [editing, setEditing] = useState(false), [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<User | null>(null);
  const currentToken = useRef(session?.token);
  currentToken.current = session?.token;
  const refreshVersion = useRef(0);
  const fetching = useRef(false);
  function fail(e: unknown) {
    const message = e instanceof Error ? e.message : 'Có lỗi xảy ra.';
    if (e instanceof ApiError && e.status === 401) { setSession(null); setUsers([]); setEditor(null); setDeleting(null); }
    setError(message);
  }
  async function refresh(current = session, silent = false, active = () => true) {
    if (!current || (silent && fetching.current)) return;
    const version = ++refreshVersion.current;
    fetching.current = true;
    if (!silent) { setLoading(true); setError(''); }
    const canApply = () => active() && version === refreshVersion.current && currentToken.current === current.token;
    try {
      if (current.isAdmin) {
        const nextUsers = await api<User[]>('/users', current.token);
        if (!canApply()) return;
        setUsers(nextUsers);
        const ownProfile = nextUsers.find(user => user.email === current.user.email);
        if (ownProfile) setSession(previous => previous?.token === current.token ? { ...previous, user: ownProfile } : previous);
      } else {
        const user = await api<User>('/me', current.token);
        if (!canApply()) return;
        setSession(previous => previous?.token === current.token ? { ...previous, user } : previous);
      }
      setError('');
    } catch (e) { if (canApply()) fail(e); }
    finally {
      if (version === refreshVersion.current) fetching.current = false;
      if (!silent) setLoading(false);
    }
  }
  useEffect(() => {
    if (!session) return;
    let disposed = false;
    const isForeground = () => AppState.currentState !== 'background'
      && AppState.currentState !== 'inactive'
      && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden);
    const sync = () => {
      if (!disposed && isForeground()) void refresh(session, true, () => !disposed);
    };
    void refresh(session, false, () => !disposed);
    const timer = setInterval(sync, 3000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('focus', sync);
    return () => {
      disposed = true;
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('focus', sync);
    };
  }, [session?.token, session?.isAdmin]);
  async function signIn() {
    setError(''); setNotice(''); setLoading(true);
    try { const result = await api<Session>('/login', undefined, 'POST', login); setSession(result); setLogin({ email: '', matkhau: '' }); }
    catch (e) { fail(e); } finally { setLoading(false); }
  }
  async function signOut() {
    if (!session) return; setSaving(true);
    try { await api('/logout', session.token, 'POST'); } catch (e) { fail(e); }
    finally { setSession(null); setUsers([]); setError(''); setNotice(''); setEditor(null); setDeleting(null); setSaving(false); }
  }
  function openEditor(user?: User) { setEditing(!!user); setEditor(user ? { ...user, matkhau: '' } : { ...empty }); setFormError(''); setNotice(''); }
  async function chooseImage() {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setFormError('Cần quyền truy cập thư viện để chọn ảnh.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: .6 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64 || asset.base64.length > 819200) { setFormError('Ảnh quá lớn. Vui lòng chọn ảnh JPEG/PNG/WebP dưới 600 KB.'); return; }
      const mime = asset.mimeType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) { setFormError('Vui lòng chọn ảnh JPEG, PNG hoặc WebP.'); return; }
      setEditor(prev => prev ? { ...prev, hinhanh: `data:${mime};base64,${asset.base64}` } : prev); setFormError('');
    } catch { setFormError('Không mở được thư viện ảnh. Kiểm tra quyền truy cập và thử lại.'); }
  }
  async function save() {
    if (!editor || !session) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editor.email.trim())) { setFormError('Vui lòng nhập email hợp lệ.'); return; }
    if (editor.hoten.trim().length < 2 || editor.hoten.trim().length > 100) { setFormError('Họ tên phải có từ 2 đến 100 ký tự.'); return; }
    if ((!editing || editor.matkhau) && (editor.matkhau.length < 8 || editor.matkhau.length > 128)) { setFormError('Mật khẩu phải có từ 8 đến 128 ký tự.'); return; }
    setSaving(true); setFormError('');
    try {
      const user = await api<User>(editing ? `/users/${encodeURIComponent(editor.email)}` : '/users', session.token, editing ? 'PUT' : 'POST', editor);
      if (user.email === session.user.email) setSession({ ...session, user });
      setEditor(null); setNotice(editing ? 'Đã cập nhật người dùng.' : 'Đã thêm người dùng mới.'); await refresh();
    } catch (e) { if (e instanceof ApiError && e.status === 401) fail(e); else setFormError(e instanceof Error ? e.message : 'Không lưu được dữ liệu.'); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!deleting || !session) return; setSaving(true);
    try { await api(`/users/${encodeURIComponent(deleting.email)}`, session.token, 'DELETE'); setDeleting(null); setNotice('Đã xóa người dùng.'); await refresh(); }
    catch (e) { setDeleting(null); fail(e); } finally { setSaving(false); }
  }
  return <SafeAreaView style={s.root}>
    <StatusBar style="dark" />
    {!session ? (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.loginContainer} keyboardShouldPersistTaps="handled">
          <View style={s.loginForm}>
            <Text style={s.title}>Đăng nhập</Text>
            <Field label="Email" email value={login.email} editable={!loading}
              onChangeText={email => { setLogin({ ...login, email }); setError(''); }} />
            <Field label="Mật khẩu" password value={login.matkhau} editable={!loading}
              onChangeText={matkhau => { setLogin({ ...login, matkhau }); setError(''); }} />
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            <Button title={loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              onPress={() => void signIn()} disabled={loading || !login.email || !login.matkhau} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    ) : <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><View style={s.sectionHead}><View style={{ flex: 1, gap: 7 }}><Text style={s.title}>{session.isAdmin ? 'Người dùng' : 'Hồ sơ của bạn'}</Text><Text style={s.muted}>Xin chào, {session.user.hoten}.</Text></View><Button secondary title="Đăng xuất" disabled={saving} onPress={() => void signOut()} /></View>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}
      {session.isAdmin ? <View style={s.card}><View style={[s.sectionHead, !wide && { flexDirection: 'column', alignItems: 'stretch' }]}><View style={{ gap: 4 }}><Text style={s.subtitle}>Danh sách người dùng</Text></View><Button title="＋ Thêm người dùng" onPress={() => openEditor()} /></View>{loading ? <ActivityIndicator color={C.green} style={{ padding: 35 }} /> : users.length === 0 ? <View style={s.empty}><Text style={s.subtitle}>Chưa có người dùng</Text><Text style={s.muted}>Thêm người dùng để bắt đầu.</Text></View> : users.map(u => <View key={u.email} style={[s.userRow, !wide && { flexWrap: 'wrap' }]}><Avatar user={u} /><View style={{ flex: 1, minWidth: 130, gap: 4 }}><Text style={s.label}>{u.hoten}{u.email === session.user.email ? ' · Bạn' : ''}</Text><Text selectable style={s.muted}>{u.email}</Text></View><View style={s.actions}><Button secondary title="Sửa" onPress={() => openEditor(u)} />{u.email !== session.user.email && <Pressable accessibilityRole="button" accessibilityLabel={`Xóa ${u.hoten}`} style={{ padding: 12 }} onPress={() => setDeleting(u)}><Text style={{ color: C.red, fontWeight: '600' }}>Xóa</Text></Pressable>}</View></View>)}</View> : <View style={[s.card, { alignItems: 'center', gap: 18, padding: 40 }]}><Avatar user={session.user} large /><Text style={s.title}>{session.user.hoten}</Text><Text selectable style={s.muted}>{session.user.email}</Text><Text style={s.hint}>Liên hệ quản trị viên khi bạn cần thay đổi thông tin.</Text><Button secondary title="Tải lại hồ sơ" disabled={loading} onPress={() => void refresh()} /></View>}</ScrollView>}
    <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => { if (!saving) setEditor(null); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}><View style={s.dialog}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 26, gap: 19 }}>{editor && <><Text style={s.title}>{editing ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>{(editor.hinhanh || editor.hoten.trim()) ? <Avatar user={editor} large /> : null}<View style={{ gap: 8 }}><Button secondary title="Chọn ảnh đại diện" disabled={saving} onPress={() => void chooseImage()} />{!!editor.hinhanh && <Pressable disabled={saving} onPress={() => setEditor({ ...editor, hinhanh: '' })}><Text style={s.link}>Bỏ ảnh đã chọn</Text></Pressable>}<Text style={s.hint}>JPEG, PNG, WebP · Tối đa 600 KB</Text></View></View><Field label="Họ và tên" value={editor.hoten} editable={!saving} onChangeText={hoten => setEditor({ ...editor, hoten })} /><Field label="Email" email value={editor.email} editable={!editing && !saving} onChangeText={email => setEditor({ ...editor, email })} hint={editing ? 'Email là khóa định danh và không thể thay đổi.' : undefined} /><Field label={editing ? 'Mật khẩu mới' : 'Mật khẩu'} password value={editor.matkhau} editable={!saving} onChangeText={matkhau => setEditor({ ...editor, matkhau })} hint={editing ? 'Để trống để giữ mật khẩu hiện tại.' : 'Từ 8 đến 128 ký tự. Mật khẩu được lưu dạng băm.'} />{!!formError && <Text accessibilityRole="alert" style={s.error}>{formError}</Text>}<View style={[s.actions, { justifyContent: 'flex-end' }]}><Button secondary title="Hủy" disabled={saving} onPress={() => setEditor(null)} /><Button title={saving ? 'Đang lưu…' : 'Lưu người dùng'} disabled={saving} onPress={() => void save()} /></View></>}</ScrollView></View></KeyboardAvoidingView></Modal>
    <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => { if (!saving) setDeleting(null); }}><View style={s.overlay}><View style={[s.card, { width: '100%', maxWidth: 440, gap: 20 }]}><Text style={s.title}>Xóa người dùng?</Text><Text style={s.description}>Bạn sẽ xóa hồ sơ của {deleting?.hoten} ({deleting?.email}). Thao tác này không thể hoàn tác.</Text><View style={[s.actions, { justifyContent: 'flex-end' }]}><Button title="Giữ lại" secondary disabled={saving} onPress={() => setDeleting(null)} /><Button title={saving ? 'Đang xóa…' : 'Xác nhận xóa'} danger disabled={saving} onPress={() => void remove()} /></View></View></View></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, hint: { fontSize: 12, color: C.muted, lineHeight: 19 }, muted: { fontSize: 14, color: C.muted, lineHeight: 21 }, loginContainer: { flexGrow: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }, loginForm: { width: '100%', maxWidth: 420, gap: 20, padding: 28, backgroundColor: '#fff', borderWidth: 1, borderColor: '#bbc9c1', borderRadius: 14 }, description: { color: C.muted, fontSize: 16, lineHeight: 26 }, card: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 24, gap: 20 }, title: { fontSize: 28, fontWeight: '700', color: C.ink, letterSpacing: -.7 }, subtitle: { fontSize: 19, color: C.ink, fontWeight: '700' }, label: { fontSize: 14, fontWeight: '600', color: C.ink }, inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 10, backgroundColor: '#fbfcfa', minHeight: 48 }, input: { flex: 1, minWidth: 0, padding: 13, fontSize: 15, color: C.ink }, link: { color: C.green, fontSize: 13, fontWeight: '600' }, button: { backgroundColor: C.green, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: '#edf2ed', borderWidth: 1, borderColor: C.line }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' }, error: { color: C.red, backgroundColor: '#fff0ed', padding: 13, borderRadius: 10, lineHeight: 21 }, success: { color: C.green, backgroundColor: '#e3f0e4', padding: 13, borderRadius: 10 }, content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 22, gap: 22 }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 20 }, userRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, borderTopWidth: 1, borderColor: C.line }, avatar: { backgroundColor: '#e1ebe5', justifyContent: 'center', alignItems: 'center' }, actions: { flexDirection: 'row', alignItems: 'center', gap: 9 }, empty: { paddingVertical: 45, alignItems: 'center', gap: 10 }, overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,35,28,.48)', padding: 18 }, dialog: { width: '100%', maxWidth: 580, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
});
