@use('App\Icons\Ios')
@use('App\Icons\Android')

<native:bottom-nav>
    <native:bottom-nav-item
        id="dashboard"
        label="Dashboard"
        url="/"
        :active="$active === 'dashboard'"
        :ios-icon="Ios::House"
        :android-icon="Android::Home"
    />
    <native:bottom-nav-item
        id="orders"
        label="Pesanan"
        url="/orders"
        :active="$active === 'orders'"
        :ios-icon="Ios::Receipt"
        :android-icon="Android::ReceiptLong"
    />
    <native:bottom-nav-item
        id="reports"
        label="Laporan"
        url="/reports"
        :active="$active === 'reports'"
        :ios-icon="Ios::ChartBar"
        :android-icon="Android::BarChart"
    />
    <native:bottom-nav-item
        id="more"
        label="Lainnya"
        url="/more"
        :active="$active === 'more'"
        :ios-icon="Ios::SquareGrid2x2"
        :android-icon="Android::GridView"
    />
</native:bottom-nav>
