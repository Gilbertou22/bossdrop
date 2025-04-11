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
    HomeOutlined: <HomeOutlined />,
    SketchOutlined: <SketchOutlined />,
    FileDoneOutlined: <FileDoneOutlined />,
    ShoppingOutlined: <ShoppingOutlined />,
    BarChartOutlined: <BarChartOutlined />,
    DollarOutlined: <DollarOutlined />,
    TeamOutlined: <TeamOutlined />,
    GiftOutlined: <GiftOutlined />,
    CheckCircleOutlined: <CheckCircleOutlined />,
    UserOutlined: <UserOutlined />,
    CloudUploadOutlined: <CloudUploadOutlined />,
    AuditOutlined: <AuditOutlined />,
    ArrowRightOutlined: <ArrowRightOutlined />,
    ArrowLeftOutlined: <ArrowLeftOutlined />,
    AlertOutlined: <AlertOutlined />,
    FileAddOutlined: <FileAddOutlined />,
    FileSearchOutlined: <FileSearchOutlined />,
    FileProtectOutlined: <FileProtectOutlined />,
    FileExclamationOutlined: <FileExclamationOutlined />,
    FileSyncOutlined: <FileSyncOutlined />,
    FileTextOutlined: <FileTextOutlined />,
    FileUnknownOutlined: <FileUnknownOutlined />,
    FileImageOutlined: <FileImageOutlined />,
    FileZipOutlined: <FileZipOutlined />,
    FilePdfOutlined: <FilePdfOutlined />,
    FileMarkdownOutlined: <FileMarkdownOutlined />,
    FileWordOutlined: <FileWordOutlined />,
    FileExcelOutlined: <FileExcelOutlined />,
    BugOutlined: <BugOutlined />,
    BulbOutlined: <BulbOutlined />,
    CalculatorOutlined: <CalculatorOutlined />,
    CommentOutlined: <CommentOutlined />,
    CrownOutlined: <CrownOutlined />,
    EnvironmentOutlined: <EnvironmentOutlined />,
    EyeOutlined: <EyeOutlined />,
    FieldTimeOutlined: <FieldTimeOutlined />,
    FireOutlined: <FireOutlined />,
    GlobalOutlined: <GlobalOutlined />,
    LockOutlined: <LockOutlined />,
    MailOutlined: <MailOutlined />,
    PhoneOutlined: <PhoneOutlined />,
    PrinterOutlined: <PrinterOutlined />,
    SafetyCertificateOutlined: <SafetyCertificateOutlined />,
    ScheduleOutlined: <ScheduleOutlined />,
    SearchOutlined: <SearchOutlined />,
    SettingOutlined: <SettingOutlined />,
    ShareAltOutlined: <ShareAltOutlined />,
    ShoppingCartOutlined: <ShoppingCartOutlined />,
    TruckOutlined: <TruckOutlined />,
    TranslationOutlined: <TranslationOutlined />,
    UserAddOutlined: <UserAddOutlined />,
    UserDeleteOutlined: <UserDeleteOutlined />,
    UserSwitchOutlined: <UserSwitchOutlined />,
    UsergroupAddOutlined: <UsergroupAddOutlined />,
    UsergroupDeleteOutlined: <UsergroupDeleteOutlined />,
    WalletOutlined: <WalletOutlined />,
    WechatOutlined: <WechatOutlined />,
    WhatsAppOutlined: <WhatsAppOutlined />,
    YoutubeOutlined: <YoutubeOutlined />,
    VerifiedOutlined: <VerifiedOutlined />,
    WifiOutlined: <WifiOutlined />,
    WarningOutlined: <WarningOutlined />,
    UsbOutlined: <UsbOutlined />,
    WomanOutlined: <WomanOutlined />,
    ThunderboltOutlined: <ThunderboltOutlined />,
    StarOutlined: <StarOutlined />,
    SunOutlined: <SunOutlined />,
    ProfileOutlined: <ProfileOutlined />,
    ProductOutlined: <ProductOutlined />,
    MenuOutlined: <MenuOutlined />,
    LaptopOutlined: <LaptopOutlined />,
    HistoryOutlined: <HistoryOutlined />,
    GoldOutlined: <GoldOutlined />,
    FieldBinaryOutlined: <FieldBinaryOutlined />,
    ExperimentOutlined: <ExperimentOutlined />,
    DatabaseOutlined: <DatabaseOutlined />,
    DashboardOutlined: <DashboardOutlined />,
    CoffeeOutlined: <CoffeeOutlined />,
    CloudOutlined: <CloudOutlined />,
    CameraOutlined: <CameraOutlined />,
    CarOutlined: <CarOutlined />,
    AppstoreOutlined: <AppstoreOutlined />,
    ApartmentOutlined: <ApartmentOutlined />,
    BarcodeOutlined: <BarcodeOutlined />,
    BankOutlined: <BankOutlined />,
    BookOutlined: <BookOutlined />,
    FullscreenOutlined: <FullscreenOutlined />,
    FullscreenExitOutlined: <FullscreenExitOutlined />,
    RetweetOutlined: <RetweetOutlined />,
    QuestionCircleOutlined: <QuestionCircleOutlined />,
    InfoOutlined: <InfoOutlined />,
    ClockCircleOutlined: <ClockCircleOutlined />,
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