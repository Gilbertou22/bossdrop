import React from 'react';
import { Space, Avatar, Typography } from 'antd';
import {
    HomeOutlined, SketchOutlined, FileDoneOutlined, ShoppingOutlined, BarChartOutlined, DollarOutlined, TeamOutlined, GiftOutlined,
    CheckCircleOutlined, UserOutlined, CloudUploadOutlined, AuditOutlined, ArrowRightOutlined, ArrowLeftOutlined, AlertOutlined,
    FileAddOutlined, FileSearchOutlined, FileProtectOutlined, FileExclamationOutlined, FileSyncOutlined, FileTextOutlined,
    FileUnknownOutlined, FileImageOutlined, FileZipOutlined, FilePdfOutlined, FileMarkdownOutlined, FileWordOutlined, FileExcelOutlined,
    BugOutlined, BulbOutlined, CalculatorOutlined, CommentOutlined, CrownOutlined, EnvironmentOutlined, EyeOutlined, FieldTimeOutlined,
    FireOutlined, GlobalOutlined, LockOutlined, MailOutlined, PhoneOutlined, PrinterOutlined,
    SafetyCertificateOutlined, ScheduleOutlined, SearchOutlined, SettingOutlined, ShareAltOutlined, ShoppingCartOutlined,
    TruckOutlined, TranslationOutlined, UserAddOutlined, UserDeleteOutlined, UserSwitchOutlined,
    UsergroupAddOutlined, UsergroupDeleteOutlined, WalletOutlined, WechatOutlined, WhatsAppOutlined, YoutubeOutlined,
    VerifiedOutlined, WifiOutlined, WarningOutlined, UsbOutlined, WomanOutlined, ThunderboltOutlined, StarOutlined, SunOutlined,
    ProfileOutlined, ProductOutlined, MenuOutlined, LaptopOutlined, HistoryOutlined, GoldOutlined, FieldBinaryOutlined,
    ExperimentOutlined, DatabaseOutlined, DashboardOutlined, CoffeeOutlined, CloudOutlined, CameraOutlined, CarOutlined,
    AppstoreOutlined, ApartmentOutlined, BarcodeOutlined, BankOutlined, BookOutlined, FullscreenOutlined, FullscreenExitOutlined,
    RetweetOutlined, QuestionCircleOutlined, InfoOutlined, ClockCircleOutlined
} from '@ant-design/icons';

// 圖標映射表
const iconMapping = {
    AlertOutlined: <AlertOutlined />,
    ApartmentOutlined: <ApartmentOutlined />,
    AppstoreOutlined: <AppstoreOutlined />,
    ArrowLeftOutlined: <ArrowLeftOutlined />,
    ArrowRightOutlined: <ArrowRightOutlined />,
    AuditOutlined: <AuditOutlined />,
    BankOutlined: <BankOutlined />,
    BarChartOutlined: <BarChartOutlined />,
    BarcodeOutlined: <BarcodeOutlined />,
    BookOutlined: <BookOutlined />,
    BugOutlined: <BugOutlined />,
    BulbOutlined: <BulbOutlined />,
    CalculatorOutlined: <CalculatorOutlined />,
    CameraOutlined: <CameraOutlined />,
    CarOutlined: <CarOutlined />,
    CheckCircleOutlined: <CheckCircleOutlined />,
    ClockCircleOutlined: <ClockCircleOutlined />,
    CloudOutlined: <CloudOutlined />,
    CloudUploadOutlined: <CloudUploadOutlined />,
    CoffeeOutlined: <CoffeeOutlined />,
    CommentOutlined: <CommentOutlined />,
    CrownOutlined: <CrownOutlined />,
    DashboardOutlined: <DashboardOutlined />,
    DatabaseOutlined: <DatabaseOutlined />,
    DollarOutlined: <DollarOutlined />,
    EnvironmentOutlined: <EnvironmentOutlined />,
    ExperimentOutlined: <ExperimentOutlined />,
    EyeOutlined: <EyeOutlined />,
    FieldBinaryOutlined: <FieldBinaryOutlined />,
    FieldTimeOutlined: <FieldTimeOutlined />,
    FileAddOutlined: <FileAddOutlined />,
    FileDoneOutlined: <FileDoneOutlined />,
    FileExcelOutlined: <FileExcelOutlined />,
    FileExclamationOutlined: <FileExclamationOutlined />,
    FileImageOutlined: <FileImageOutlined />,
    FileMarkdownOutlined: <FileMarkdownOutlined />,
    FilePdfOutlined: <FilePdfOutlined />,
    FileProtectOutlined: <FileProtectOutlined />,
    FileSearchOutlined: <FileSearchOutlined />,
    FileSyncOutlined: <FileSyncOutlined />,
    FileTextOutlined: <FileTextOutlined />,
    FileUnknownOutlined: <FileUnknownOutlined />,
    FileWordOutlined: <FileWordOutlined />,
    FileZipOutlined: <FileZipOutlined />,
    FireOutlined: <FireOutlined />,
    FullscreenExitOutlined: <FullscreenExitOutlined />,
    FullscreenOutlined: <FullscreenOutlined />,
    GiftOutlined: <GiftOutlined />,
    GlobalOutlined: <GlobalOutlined />,
    GoldOutlined: <GoldOutlined />,
    HistoryOutlined: <HistoryOutlined />,
    HomeOutlined: <HomeOutlined />,
    InfoOutlined: <InfoOutlined />,
    LaptopOutlined: <LaptopOutlined />,
    LockOutlined: <LockOutlined />,
    MailOutlined: <MailOutlined />,
    MenuOutlined: <MenuOutlined />,
    PhoneOutlined: <PhoneOutlined />,
    PrinterOutlined: <PrinterOutlined />,
    ProductOutlined: <ProductOutlined />,
    ProfileOutlined: <ProfileOutlined />,
    QuestionCircleOutlined: <QuestionCircleOutlined />,
    RetweetOutlined: <RetweetOutlined />,
    SafetyCertificateOutlined: <SafetyCertificateOutlined />,
    ScheduleOutlined: <ScheduleOutlined />,
    SearchOutlined: <SearchOutlined />,
    SettingOutlined: <SettingOutlined />,
    ShareAltOutlined: <ShareAltOutlined />,
    ShoppingCartOutlined: <ShoppingCartOutlined />,
    ShoppingOutlined: <ShoppingOutlined />,
    SketchOutlined: <SketchOutlined />,
    StarOutlined: <StarOutlined />,
    SunOutlined: <SunOutlined />,
    TeamOutlined: <TeamOutlined />,
    ThunderboltOutlined: <ThunderboltOutlined />,
    TranslationOutlined: <TranslationOutlined />,
    TruckOutlined: <TruckOutlined />,
    UsbOutlined: <UsbOutlined />,
    UserAddOutlined: <UserAddOutlined />,
    UserDeleteOutlined: <UserDeleteOutlined />,
    UsergroupAddOutlined: <UsergroupAddOutlined />,
    UsergroupDeleteOutlined: <UsergroupDeleteOutlined />,
    UserOutlined: <UserOutlined />,
    UserSwitchOutlined: <UserSwitchOutlined />,
    VerifiedOutlined: <VerifiedOutlined />,
    WalletOutlined: <WalletOutlined />,
    WarningOutlined: <WarningOutlined />,
    WechatOutlined: <WechatOutlined />,
    WhatsAppOutlined: <WhatsAppOutlined />,
    WifiOutlined: <WifiOutlined />,
    WomanOutlined: <WomanOutlined />,
    YoutubeOutlined: <YoutubeOutlined />,

};

const { Text } = Typography;

// 導出圖標映射對象
export const getIconMapping = () => iconMapping;

// 導出一個函數來獲取圖標名稱列表（用於 Select 組件）
export const getIconNames = () => Object.keys(iconMapping);

// 導出一個組件來渲染圖標（用於表格和菜單預覽）
export const IconRenderer = ({ icon, customIcon }) => {
    if (customIcon) {
        return <Avatar src={customIcon} size={20} />;
    }
    if (icon && iconMapping[icon]) {
        return (
            <Space>
                {iconMapping[icon]}
                <Text>{icon}</Text>
            </Space>
        );
    }
    return '無';
};