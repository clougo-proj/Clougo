#!/usr/bin/perl
# usage: mkjson.pl <root_dir>

use JSON;

my @filetype = qw/lgo ljs in out err eval parse codegen draw/;
my $json = JSON->new->allow_nonref;
my $root = $ARGV[0];
my $toJs = $ARGV[1] eq "--js";

die "makeut.pl <root_dir>" unless (-e $root && -d $root);
my ($dir, $parent) = @{splitPath($root)};

if ($toJs) {
    print "var $dir = ";
}

print encodeDir($dir, $parent);

if ($toJs) {
    print ";\nif (typeof exports !== \"undefined\") { exports.unittests = unittests; }\n";
}

sub splitPath {
    my $path = shift;
    if ($path =~ /^(.*)[\/\\]([^\/\\]+)$/) {
        return [$2, $1];
    }

    return [$path, $1];
}

sub encodeDir {
    my ($dir, $parent) = @_;
    my $path = !defined($parent) ? $dir : "$parent/$dir";
    my $dirCases = encodeDirCases($path);
    my @subDirs = map { /\/([^\/]+)$/; $1 } grep {/\//} grep {-e $_ && -d $_} glob("$path/*");
    my @encodedSubDirs = map { "\"$_\": " . encodeDir($_, $path) } @subDirs;

    return "{" . join(",", @$dirCases, @encodedSubDirs) . "}";
}

sub encodeDirCases {
    my $dir = shift;
    my @ret = map { encodeCase($_, $dir); } getListOfCases($dir);
    return \@ret;
}

sub encodeCase {
    my ($case, $dir) = @_;
    my $name = $case->[0];
    my $tag = $case->[1];
    my @file = ();

    push @file, "\"$name\": {\"__tag__\": [";
    push @file, join(", ", map { "\"$_\"" } @$tag);
    push @file, "]";

    foreach my $type(@filetype) {
        my $filename = "$dir/$name.$type";
        if (-e $filename && -f $filename) {
            push @file, ",\"__$type\__\":";
            push @file, encodeFile($filename);
        }
    }

    push @file, "}";

    return join("", @file);
}

sub getListOfCases {
    my $dir = shift;
    my @case=();
    open (IN, "$dir/list.txt");
    while (<IN>) {
        chomp;
        $_ =~ s/#.*$//g;
        next if (/^\s*$/);
        my ($name, @tag) = split;
        push @case,[$name, \@tag];
    }
    return @case;
}

sub encodeFile {
    my ($srcfile) = @_;
    open(IN, $srcfile);
    my @file = <IN>;
    return $json->encode(join("", @file));
}
