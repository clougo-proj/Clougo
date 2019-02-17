#!/usr/bin/perl
# usage: makeut.pl <unit_test_root_dir>


my $root = $ARGV[0];
die "makeut.pl <unit_test_root_dir>" unless (-e $root && -d $root);

my $jstest_head = "";

my $jstest_tail =
"\n" .
"if (typeof exports != \"undefined\") {\n" .
"    exports.$root = $root;\n" .
"}\n";

print $jstest_head;
compileDir($root);
print $jstest_tail;

sub compileDir {
    my ($dir, $parent, $prefix) = @_;
    #print "DIR: $dir\n";
    #print "PAR: $parent\n";
    #print "PRE: $prefix\n";
    my $qualifier;
    if (defined($prefix)) {
        $qualifier = "$prefix\[\"$dir\"\]";
        print "$qualifier = {};\n";
    } else {
        $qualifier = $dir;
        print "var $qualifier = {};\n";
    }

    my $path = !defined($parent) ? $dir : "$parent/$dir";
    my $jstest = compileUnitTest($path, $qualifier);
    print $jstest;

    my @dir = map { /\/([^\/]+)$/; $1 } grep {/\//} grep {-e $_ && -d $_} glob("$path/*");
    foreach (@dir) {
        compileDir($_, $path, $qualifier);
    }
}

sub compileUnitTest {
    my @filetype = qw/lgo ljs in out err eval parse codegen draw/;
    my ($dir, $prefix) = @_;
    #my @test = map {(split(/\./, $_))[0]} map {(split("\/", $_))[-1]} glob("logo/$dir/*.lgo");
    my @test = getListOfTests("$dir");
    my $jstest = '';
    foreach my $test(@test) {
        #print "$test->[0] $test->[1][0] $test->[1][1]\n";
        my $testname = $test->[0];
        my $testcmd = $test->[1];
        $jstest .= "$prefix\[\"$testname\"\] = {\n";
        $jstest .= "\"__command__\": [" . join(", ", map { "\"$_\"" } @$testcmd) . "]";
        foreach my $type(@filetype) {
            my $filename = "$dir/$testname.$type";
            if (-e $filename && -f $filename) {
                $jstest .= ",\n\"__$type\__\":\n";
                appendFile(\$jstest, $filename);
            }
        }
        $jstest .= "\n};\n";

=abc
        foreach my $type(@filetype)
        my $logosrc = "logo/$dir/$test.lgo";
        my $baseline = "logo/$dir/$test.base";

        if (-e $logosrc && -f $logosrc) {
        #    open(IN, $logosrc);
            $jstest .= "{\n";
            $jstest .= "name: \"$test\",\n";
            $jstest .= "command: \"exec\",\n";
            $jstest .= "src:\n";
            appendFile(\$jstest, $logosrc);

            if (-e $baseline && -f $baseline) {
                $jstest .= ",\n";
                $jstest .= "output:\n";
                appendFile(\$jstest, $baseline);
            }
            $jstest .= "\n},\n";
        }
=cut
    }

    return $jstest;
}

sub getListOfTests {
    my $dir = shift;
    #return map {[$_, ["run", "exec"]]} map {(split(/\./, $_))[0]} map {(split("\/", $_))[-1]} glob("$dir/*.lgo");
    #return map {[$_, ["run", "exec"]]} map {(split(/\./, $_))[0]} map {(split("\/", $_))[-1]} glob("$dir/*.lgo");
    my @test=();
    open (IN, "$dir/test.txt");
    while (<IN>) {
        chomp;
        $_ =~ s/#.*$//g;
        next if (/^\s*$/); # || /^\s*#/);
        my ($testname, @cmd) = split;
        push @test,[$testname, \@cmd];
    }
    return @test;
}

sub appendFile {
    my ($jstest, $srcfile) = @_;
    open(IN, $srcfile);

=abc
    if($_=<IN>) {
        chomp;
        s/\"/\\"/g;
        $$jstest .= "\"$_\\n\"";
    }

    while(<IN>) {
        chomp;
        s/\"/\\"/g;
        $$jstest .= "+\n\"$_\\n\"";
    }
=cut
    my @file = map { chomp; s/\r$//; s/(\"|\(|\)|\\)/\\$1/g; $_ } <IN>;
    $$jstest .= "\"" . join("\\n", @file) . "\\n\"";

    close(IN);
}
